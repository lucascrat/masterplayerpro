import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

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

    const onPlaying = () => { clearTO(); setLoading(false); };
    const onCanPlay = () => { clearTO(); setLoading(false); };
    const onWaiting = () => setLoading(true);
    const onError   = () => {
      clearTO();
      setLoading(false);
      console.error('[Player] Erro no elemento video');
      setError('Não foi possível reproduzir este conteúdo.');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
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
      });
      hlsRef.current = hls;
      const source = isHls ? effectiveUrl : virtualManifest;
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        console.warn(`[Player] HLS Error: ${data.details}`, data);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            clearTO();
            setLoading(false);
            
            let errorMsg = `Erro no stream (${data.details}).`;
            if (data.response && data.response.code === 502) {
               errorMsg = 'O servidor de IPTV não respondeu. Tente novamente.';
            } else if (data.details === 'manifestParsingError') {
               errorMsg = 'Falha ao processar o canal. Pode estar offline.';
            }

            setError(errorMsg);
            hls.destroy();
            hlsRef.current = null;
          }
        }
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
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error',   onError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      video.pause();
      video.src = '';
      video.load();
    };
  }, [url, effectiveUrl, isHls, isMp4, virtualManifest]);

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
              onClick={handleClose}
              style={{
                background: '#8B5CF6', color: '#fff', border: 'none',
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
