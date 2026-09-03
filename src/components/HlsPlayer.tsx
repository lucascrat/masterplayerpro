import { useEffect, useRef, useState } from 'react';
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
  onClose: () => void;
}

// Chrome 86+ blocks ALL HTTP media (video, audio) from HTTPS pages —
// even native <video> elements. The only fix is to route every HTTP
// stream through our own HTTPS proxy endpoint.
// ALL http:// URLs must go through /api/proxy so the browser only
// sees HTTPS and mixed-content blocking never triggers.
function getEffectiveUrl(url: string): string {
  if (url.startsWith('http://')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function HlsPlayer({ url, onClose }: HlsPlayerProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsEnteredRef = useRef(false);

  // Improved detection
  const isHls = url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('/hls/');
  const isMp4 = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mkv');
  // Anything that is neither HLS nor MP4 is treated as a raw TS stream and
  // wrapped in a virtual HLS manifest below.

  const effectiveUrl = getEffectiveUrl(url);

  // Virtual HLS manifest (only for TS streams)
  const virtualManifest = `data:application/vnd.apple.mpegurl;base64,${btoa(
    `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\n${effectiveUrl}`
  )}`;

  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry,   setRetry]   = useState(0);

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

    console.log(`[Player] Iniciando: ${url}`);
    console.log(`[Player] Tipo Detectado: ${isHls ? 'HLS' : isMp4 ? 'MP4/Direct' : 'TS/Wrap'}`);

    setError(null);
    setLoading(true);
    fsEnteredRef.current = false;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('O servidor demorou muito para responder. Tente o VLC.');
    }, 25000);

    const clearTO = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };

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

    const onPlaying = () => { clearTO(); setLoading(false); maybeResume(); };
    const onCanPlay = () => { clearTO(); setLoading(false); maybeResume(); };
    const onLoadedMeta = () => maybeResume();
    const onWaiting = () => setLoading(true);
    const onError   = () => {
      clearTO();
      setLoading(false);
      console.error('[Player] Erro no elemento video');
      setError('Não foi possível reproduzir este conteúdo.');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error',   onError);

    // Decision logic
    if (isMp4) {
      // Direct playback for MP4/MKV
      video.src = effectiveUrl;
      video.load();
      video.play().catch(() => {});
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
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        console.warn(`[Player] HLS Error: ${data.details} (fatal=${data.fatal})`);
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < MAX_NET_RETRIES) {
          netRetries++;
          console.log(`[Player] Reconectando (${netRetries}/${MAX_NET_RETRIES})...`);
          setLoading(true);
          setTimeout(() => hls.startLoad(), 1000 * netRetries);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < MAX_MEDIA_RETRIES) {
          mediaRetries++;
          console.log(`[Player] Recuperando erro de mídia (${mediaRetries}/${MAX_MEDIA_RETRIES})...`);
          hls.recoverMediaError();
          return;
        }

        clearTO();
        setLoading(false);
        let errorMsg = 'Não foi possível reproduzir este conteúdo.';
        if (data.response && (data.response.code === 502 || data.response.code === 504)) {
          errorMsg = 'O servidor de IPTV não respondeu. Tente novamente em instantes.';
        } else if (data.details === 'manifestParsingError' || data.details === 'manifestLoadError') {
          errorMsg = 'Falha ao carregar o canal. Ele pode estar offline.';
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          errorMsg = 'Conexão instável com o servidor de streaming.';
        }
        setError(errorMsg);
        hls.destroy();
        hlsRef.current = null;
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari/iOS
      video.src = effectiveUrl;
      video.load();
      video.play().catch(() => {});
    } else {
      clearTO();
      setError('Navegador incompatível com este formato.');
    }

    return () => {
      clearTO();
      persist(); // remember position on close / source change
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error',   onError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      video.pause();
      video.src = '';
      video.load();
    };
  }, [url, effectiveUrl, isHls, isMp4, virtualManifest, retry]);

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
        crossOrigin="anonymous"
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
              onClick={() => { setError(null); setLoading(true); setRetry(r => r + 1); }}
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
              href={`vlc://${url}`}
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
