import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { getResumePosition, saveProgress } from '../lib/watchProgress';
import { toast } from './Toast';

function fmtTime(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

interface HlsPlayerProps {
  url: string;
  /** Ordered quality-variant URLs to fall back through if a stream stalls.
   *  Element 0 is normally the same as `url`. Empty/omitted = no fallback. */
  fallbackUrls?: string[];
  onClose: () => void;
}

// ── Stream delivery strategy ────────────────────────────────────────────────
// A page served over HTTPS cannot load http:// media (mixed content), so an
// http:// stream can't be played by the browser as-is. Two ways to deliver it:
//
//   'direct' — rewrite http:// → https:// and let the BROWSER fetch it.
//              Streams over the VIEWER'S OWN IP, zero server load, and dodges
//              the provider's per-IP rate-limit. Works when the provider
//              serves valid HTTPS; for hls.js (Android/desktop) it also needs
//              the provider to send CORS headers. iOS native HLS needs neither.
//
//   'proxy'  — route through our /api/proxy (server's IP, always works, but
//              all traffic exits one IP and the provider throttles it).
//
// We try 'direct' first, then fall back to 'proxy'. Already-https URLs are
// tried direct first too; a plain relative/blob URL is passed straight through.

type DeliveryMode = 'direct' | 'proxy';
interface StreamSource { playUrl: string; mode: DeliveryMode; originalUrl: string; }

function proxied(u: string): string {
  return `/api/proxy?url=${encodeURIComponent(u)}`;
}

/** Build the ordered list of (deliveryMode × url) attempts for one logical stream. */
function sourcesFor(rawUrl: string): StreamSource[] {
  if (rawUrl.startsWith('http://')) {
    const asHttps = 'https://' + rawUrl.slice('http://'.length);
    return [
      { playUrl: asHttps, mode: 'direct', originalUrl: rawUrl },
      { playUrl: proxied(rawUrl), mode: 'proxy', originalUrl: rawUrl },
    ];
  }
  if (rawUrl.startsWith('https://')) {
    return [
      { playUrl: rawUrl, mode: 'direct', originalUrl: rawUrl },
      { playUrl: proxied(rawUrl), mode: 'proxy', originalUrl: rawUrl },
    ];
  }
  return [{ playUrl: rawUrl, mode: 'direct', originalUrl: rawUrl }];
}

export default function HlsPlayer({ url, fallbackUrls, onClose }: HlsPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsEnteredRef = useRef(false);
  // Set once a 'direct' source fails — the rest will fail identically.
  const directHopelessRef = useRef(false);

  // Logical candidate URLs (quality variants). Falls back to just [url].
  const candidates = (fallbackUrls && fallbackUrls.length > 0) ? fallbackUrls : [url];

  // Expand each into [direct, proxy] attempts → one flat ordered chain.
  const chainKey = candidates.join('|');
  const sourceChain: StreamSource[] = useMemo(
    () => candidates.flatMap(sourcesFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chainKey],
  );

  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [retry,     setRetry]     = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  // New item selected upstream → restart from the first source.
  useEffect(() => { setActiveIdx(0); setRetry(0); directHopelessRef.current = false; }, [url]);

  const active = sourceChain[Math.min(activeIdx, sourceChain.length - 1)]
    ?? { playUrl: url, mode: 'proxy' as DeliveryMode, originalUrl: url };
  const effectiveUrl = active.playUrl;
  const hasNextCandidate = activeIdx < sourceChain.length - 1;

  // Detection is based on the ORIGINAL url (the proxied form hides the ext in a
  // query string, but .m3u8/.mp4 substring checks still work either way).
  const detectUrl = active.originalUrl.toLowerCase();
  const isHls = detectUrl.includes('.m3u8') || detectUrl.includes('/hls/');
  const isMp4 = detectUrl.includes('.mp4') || detectUrl.includes('.mkv');
  // Anything that is neither HLS nor MP4 is treated as a raw TS stream and
  // wrapped in a virtual HLS manifest below.

  // crossOrigin only helps when the response actually carries CORS headers —
  // that's our own /api/proxy (same-origin). For a direct cross-origin stream
  // with no CORS headers, setting it would BREAK native <video> playback.
  const useCors = active.mode === 'proxy';

  // ── Fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    const el    = containerRef.current;
    if (!el || !video) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Firefox/.test(navigator.userAgent);

    const tryFullscreen = () => {
      const req = el.requestFullscreen?.bind(el) || (el as any).webkitRequestFullscreen?.bind(el);
      if (req) req().then(() => { fsEnteredRef.current = true; }).catch(() => {});
    };

    const tryVideoFs = () => {
      const enterFS = (video as any).webkitEnterFullscreen;
      if (enterFS && !isIOS) { fsEnteredRef.current = true; enterFS.call(video); }
    };

    const timer = setTimeout(() => {
      if (isIOS || isSafari) return;
      if (document.fullscreenElement) return;
      if ((video as any).webkitEnterFullscreen) tryVideoFs();
      else tryFullscreen();
    }, 300);

    const onFsChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsEl && fsEnteredRef.current) onClose();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [onClose]);

  const handleClose = () => {
    const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fsEl) {
      const exit = document.exitFullscreen?.bind(document) || (document as any).webkitExitFullscreen?.bind(document);
      if (exit) exit().catch(() => {});
    }
    onClose();
  };

  // ── Video source setup ──────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Guard against a double-invoke (StrictMode / fast remount) opening two
    // upstream connections for the same stream — IPTV providers cap
    // simultaneous connections and the 2nd one stalls both.
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    console.log(`[Player] Iniciando (${activeIdx + 1}/${sourceChain.length}) [${active.mode}]: ${effectiveUrl}`);
    console.log(`[Player] Tipo Detectado: ${isHls ? 'HLS' : isMp4 ? 'MP4/Direct' : 'TS/Wrap'}`);

    // Virtual HLS manifest wrapper for raw TS streams (computed here so it
    // never lands in the effect dep array).
    const virtualManifest = `data:application/vnd.apple.mpegurl;base64,${btoa(
      `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\n${effectiveUrl}`
    )}`;

    setError(null);
    setLoading(true);
    fsEnteredRef.current = false;

    const clearTO = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };

    // A source failed (stall/timeout/fatal error). Advance to the next usable
    // source silently; only surface the error screen once none are left.
    let failed = false;
    const failStream = (msg: string) => {
      if (failed) return;
      failed = true;
      clearTO();

      // Once a direct attempt has failed, every other direct source will fail
      // the same way (this provider serves segments from an HTTP-only CDN, so
      // an HTTPS page can never load them). Skip them instead of burning a
      // timeout on each.
      if (active.mode === 'direct') directHopelessRef.current = true;

      let next = activeIdx + 1;
      if (directHopelessRef.current) {
        while (next < sourceChain.length && sourceChain[next].mode === 'direct') next++;
      }

      if (next < sourceChain.length) {
        const n = sourceChain[next];
        console.log(`[Player] Fonte ${activeIdx + 1} (${active.mode}) falhou — indo para ${next + 1} (${n.mode})`);
        // Only tell the user when the quality actually changes, not on a
        // transparent direct→proxy switch of the same stream.
        if (n.originalUrl !== active.originalUrl) {
          toast('Tentando outra qualidade…', 'info', 2500);
        }
        setActiveIdx(next);
      } else {
        setLoading(false);
        setError(msg);
      }
    };

    // A doomed direct attempt normally errors within a second or two; the cap
    // is just a backstop. The proxy path gets the real budget.
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      failStream('O servidor demorou muito para responder. Tente o VLC.');
    }, active.mode === 'direct' ? 8000 : 18000);

    // ── Resume where the user left off (VOD only; live streams have no
    //    finite duration so saveProgress simply ignores them) ──────────
    const resumeAt = getResumePosition(url);
    let resumeApplied = false;
    const maybeResume = () => {
      if (resumeApplied || resumeAt == null) return;
      if (!isFinite(video.duration) || video.duration <= 0) return; // live
      if (resumeAt >= video.duration - 5) { resumeApplied = true; return; }
      resumeApplied = true;
      try {
        video.currentTime = resumeAt;
        toast(`Retomando de ${fmtTime(resumeAt)}`, 'info', 3000);
      } catch { /* seek not ready yet — retry on next event */ resumeApplied = false; }
    };

    let lastSave = 0;
    const persist = () => {
      if (video.currentTime < 5) return; // don't clobber a saved point on retry/instant close
      if (!isFinite(video.duration) || video.duration <= 0) return;
      saveProgress(url, video.currentTime, video.duration);
    };
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSave < 10000) return;
      lastSave = now;
      persist();
    };

    // Chrome refuses un-muted autoplay without a user gesture: play() rejects,
    // the video sits paused and the spinner never clears. Fall back to muted
    // autoplay (always allowed) so the stream actually starts.
    const startPlayback = () => {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => { /* user will hit play */ });
      });
    };

    const clearSpinner = () => { clearTO(); setLoading(false); };
    const onPlaying    = () => { clearSpinner(); maybeResume(); };
    const onCanPlay    = () => { clearSpinner(); maybeResume(); startPlayback(); };
    const onLoadedData = () => clearSpinner();   // frames decoded — we're up
    const onLoadedMeta = () => maybeResume();
    // Only re-arm the spinner for a genuine mid-stream stall.
    const onWaiting    = () => { if (video.readyState < 3) setLoading(true); };
    const onError      = () => {
      console.error('[Player] Erro no elemento video');
      failStream('Não foi possível reproduzir este conteúdo.');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error',   onError);

    // Decision logic
    if (isMp4) {
      // Direct playback for MP4/MKV
      video.src = effectiveUrl;
      video.load();
      startPlayback();
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
      });
      hlsRef.current = hls;
      const source = isHls ? effectiveUrl : virtualManifest;

      // Bounded self-healing: recover a few times before surfacing an error.
      let netRetries = 0;
      let mediaRetries = 0;
      const MAX_NET_RETRIES = 3;
      const MAX_MEDIA_RETRIES = 2;

      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => startPlayback());
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        console.warn(`[Player] HLS Error: ${data.details} (fatal=${data.fatal})`);
        if (!data.fatal) return;

        const code = data.response?.code;
        // A verdict like 403/404/410/429 will not change by reconnecting —
        // reconnecting just burns the whole timeout before we move on, which
        // is what left the player spinning. Go to the next source now.
        const permanent = [403, 404, 410, 429].includes(code as number);

        if (!permanent && data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < MAX_NET_RETRIES) {
          netRetries++;
          console.log(`[Player] Reconectando (${netRetries}/${MAX_NET_RETRIES})...`);
          setLoading(true);
          setTimeout(() => hls.startLoad(), 1000 * netRetries);
          return;
        }

        if (!permanent && data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < MAX_MEDIA_RETRIES) {
          mediaRetries++;
          console.log(`[Player] Recuperando erro de mídia (${mediaRetries}/${MAX_MEDIA_RETRIES})...`);
          hls.recoverMediaError();
          return;
        }

        let errorMsg = 'Não foi possível reproduzir este conteúdo.';
        if (code === 429) {
          errorMsg = 'O provedor limitou este canal agora (muitas conexões). Tente outra qualidade ou aguarde alguns minutos.';
        } else if (code === 403) {
          errorMsg = 'Acesso negado pelo provedor neste canal.';
        } else if (code === 404 || code === 410) {
          errorMsg = 'Este canal saiu do ar no provedor.';
        } else if (code === 502 || code === 504) {
          errorMsg = 'O servidor de IPTV não respondeu. Tente novamente em instantes.';
        } else if (data.details === 'manifestParsingError' || data.details === 'manifestLoadError') {
          errorMsg = 'Falha ao carregar o canal. Ele pode estar offline.';
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          errorMsg = 'Conexão instável com o servidor de streaming.';
        }
        hls.destroy();
        hlsRef.current = null;
        failStream(errorMsg);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS
      video.src = effectiveUrl;
      video.load();
      startPlayback();
    } else {
      clearTO();
      setError('Navegador incompatível com este formato.');
    }

    return () => {
      clearTO();
      persist(); // remember position on close / source change
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error',   onError);
      if (hlsRef.current) {
        try { hlsRef.current.stopLoad(); } catch { /* noop */ }
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, effectiveUrl, isHls, isMp4, retry, activeIdx]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0,
        background: '#000', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        controls
        playsInline
        autoPlay
        crossOrigin={useCors ? 'anonymous' : undefined}
        preload="auto"
      />

      {/* Loading spinner */}
      {loading && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', background: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            width: 52, height: 52,
            border: '4px solid rgba(255,255,255,0.15)',
            borderTopColor: '#8B5CF6', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginTop: 16 }}>
            Carregando...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <div style={{
            color: '#fff', fontSize: '1rem',
            textAlign: 'center', maxWidth: 320, lineHeight: 1.5,
          }}>{error}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => { setError(null); setLoading(true); setActiveIdx(0); setRetry(r => r + 1); }}
              style={{
                background: '#8B5CF6', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 24px',
                fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600,
              }}
            >
              ↻ Tentar novamente
            </button>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8, padding: '10px 24px',
                fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600,
              }}
            >
              ← Voltar
            </button>
            <a
              href={`vlc://${active.originalUrl}`}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8, padding: '10px 24px',
                fontSize: '0.9rem', cursor: 'pointer',
                fontWeight: 600, textDecoration: 'none',
              }}
            >
              Abrir no VLC
            </a>
          </div>
        </div>
      )}

      {/* Close button */}
      {!error && (
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.75)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8, padding: '10px 18px',
            fontSize: '1rem', cursor: 'pointer',
            zIndex: 10000, backdropFilter: 'blur(4px)',
            touchAction: 'manipulation',
          }}
        >
          ✕
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
