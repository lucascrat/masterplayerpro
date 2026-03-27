import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  url: string;
  onClose: () => void;
}

// Route HTTP streams through our server proxy (avoids mixed-content blocking)
// App is HTTPS, IPTV server is HTTP → browser blocks direct XHR to HTTP.
// Proxy fetches from server-side (no mixed content) and pipes back over HTTPS.
function proxify(url: string): string {
  if (url.startsWith('http://')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Detect HLS manifests (not bare .ts segments)
function isHlsUrl(url: string): boolean {
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.m3u8') || u.includes('/hls/');
}

export default function HlsPlayer({ url, onClose }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsEnteredRef = useRef(false);

  // Route through proxy if needed
  const effectiveUrl = proxify(url);
  const useHls = isHlsUrl(url); // check original URL, not proxified

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Request fullscreen on open
  useEffect(() => {
    const video = videoRef.current;
    const el = containerRef.current;
    if (!el || !video) return;

    const tryFullscreen = () => {
      const req =
        el.requestFullscreen?.bind(el) ||
        (el as any).webkitRequestFullscreen?.bind(el) ||
        (el as any).mozRequestFullScreen?.bind(el);
      if (req) req().then(() => { fsEnteredRef.current = true; }).catch(() => {});
    };

    const tryVideoFullscreen = () => {
      const enterFS = (video as any).webkitEnterFullscreen;
      if (enterFS) {
        fsEnteredRef.current = true;
        enterFS.call(video);
      }
    };

    const timer = setTimeout(() => {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) return;
      if ((video as any).webkitEnterFullscreen) {
        tryVideoFullscreen();
      } else {
        tryFullscreen();
      }
    }, 300);

    const onFsChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      // Only close when user actively exits fullscreen (not on denied request)
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

  // Setup video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);
    fsEnteredRef.current = false;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Hard timeout — 25 seconds to start playing before showing error
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Tempo esgotado. O stream não respondeu.');
    }, 25000);

    const clearLoadingTimeout = () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };

    const onPlaying = () => { clearLoadingTimeout(); setLoading(false); };
    const onCanPlay = () => { clearLoadingTimeout(); setLoading(false); };
    const onWaiting = () => setLoading(true);
    const onError  = () => {
      clearLoadingTimeout();
      setLoading(false);
      setError('Não foi possível reproduzir este conteúdo.');
    };

    video.addEventListener('playing',  onPlaying);
    video.addEventListener('canplay',  onCanPlay);
    video.addEventListener('waiting',  onWaiting);
    video.addEventListener('error',    onError);

    const loadWithHls = (src: string) => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (!Hls.isSupported()) {
        // Safari — native HLS
        video.src = src;
        video.play().catch(() => {});
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 30,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 1,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        if (data.fatal) {
          clearLoadingTimeout();
          setLoading(false);
          setError('Erro ao carregar stream. Verifique sua conexão.');
          hls.destroy();
          hlsRef.current = null;
        }
      });
    };

    if (useHls) {
      loadWithHls(effectiveUrl);
    } else {
      // Non-manifest URL: try HLS.js first (handles many IPTV TS stream types),
      // fall back to native <video> if HLS.js can't handle it
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
          manifestLoadingMaxRetry: 0,
          levelLoadingMaxRetry: 0,
          fragLoadingMaxRetry: 0,
        });
        hlsRef.current = hls;
        hls.loadSource(effectiveUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (data.fatal) {
            // HLS.js couldn't handle it — fall back to native <video>
            hls.destroy();
            hlsRef.current = null;
            video.src = effectiveUrl;
            video.load();
            video.play().catch(() => {});
          }
        });
      } else {
        video.src = effectiveUrl;
        video.load();
        video.play().catch(() => {});
      }
    }

    return () => {
      clearLoadingTimeout();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error',   onError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      video.pause();
      video.src = '';
      video.load();
    };
  }, [effectiveUrl, useHls]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: '#000', zIndex: 9999, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
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
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            width: 52, height: 52, border: '4px solid rgba(255,255,255,0.15)',
            borderTopColor: '#e63946', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginTop: 16 }}>
            Carregando stream...
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <div style={{
            color: '#fff', fontSize: '1rem', textAlign: 'center',
            maxWidth: 320, lineHeight: 1.5,
          }}>{error}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleClose}
              style={{
                background: '#e63946', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 24px', fontSize: '0.9rem',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              ← Voltar
            </button>
            <a
              href={`vlc://${url}`}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8, padding: '10px 24px', fontSize: '0.9rem',
                cursor: 'pointer', fontWeight: 600, textDecoration: 'none',
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
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8,
            padding: '10px 18px', fontSize: '1rem', cursor: 'pointer',
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
