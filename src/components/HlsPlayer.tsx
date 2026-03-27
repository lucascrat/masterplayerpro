import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  url: string;
  onClose: () => void;
}

// Chrome 86+ blocks ALL HTTP media (video, audio) from HTTPS pages —
// even native <video> elements. The only fix is to route every HTTP
// stream through our own HTTPS proxy endpoint.
function isHlsManifest(url: string): boolean {
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.m3u8') || u.includes('/hls/');
}

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

  const useHls      = isHlsManifest(url);
  const effectiveUrl = getEffectiveUrl(url);

  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    const el    = containerRef.current;
    if (!el || !video) return;

    const tryFullscreen = () => {
      const req =
        el.requestFullscreen?.bind(el) ||
        (el as any).webkitRequestFullscreen?.bind(el) ||
        (el as any).mozRequestFullScreen?.bind(el);
      if (req) req().then(() => { fsEnteredRef.current = true; }).catch(() => {});
    };

    const tryVideoFs = () => {
      const enterFS = (video as any).webkitEnterFullscreen;
      if (enterFS) { fsEnteredRef.current = true; enterFS.call(video); }
    };

    const timer = setTimeout(() => {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) return;
      (video as any).webkitEnterFullscreen ? tryVideoFs() : tryFullscreen();
    }, 300);

    // Only auto-close when user deliberately exits fullscreen
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
      const exit = document.exitFullscreen?.bind(document) ||
                   (document as any).webkitExitFullscreen?.bind(document);
      if (exit) exit().catch(() => {});
    }
    onClose();
  };

  // ── Video source setup ──────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);
    fsEnteredRef.current = false;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Hard timeout — show error after 25 s instead of loading forever
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Tempo esgotado. O stream não respondeu.');
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
      setError('Não foi possível reproduzir este conteúdo.');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error',   onError);

    if (useHls) {
      // ── HLS manifest (.m3u8) ─────────────────────────────────────
      // effectiveUrl is already proxied if needed (avoids XHR mixed-content block)
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          fragLoadingMaxRetry: 2,
        });
        hlsRef.current = hls;
        hls.loadSource(effectiveUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (data.fatal) {
            clearTO();
            setLoading(false);
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setError('Erro ao carregar stream HLS.');
              hls.destroy();
              hlsRef.current = null;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari — native HLS support, use original URL
        video.src = url;
        video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true });
      } else {
        clearTO();
        setError('Seu browser não suporta HLS.');
      }
    } else {
      // ── Direct stream (live channels, MP4, TS without manifest) ──
      // Use effectiveUrl (already proxied if http://) so Chrome's
      // mixed-content blocker never sees an HTTP src on HTTPS page.
      video.src = effectiveUrl;
      video.load();
      video.play().catch(() => {});
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
  }, [url, effectiveUrl, useHls]);

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
          }}
        >
          ✕
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
