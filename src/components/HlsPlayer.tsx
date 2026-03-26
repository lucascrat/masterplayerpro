import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  url: string;
  onClose: () => void;
}

function isHlsUrl(url: string): boolean {
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.m3u8') || u.endsWith('.ts') || u.includes('/hls/');
}

export default function HlsPlayer({ url, onClose }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const useHls = isHlsUrl(url);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Request fullscreen on open
  useEffect(() => {
    const video = videoRef.current;
    const el = containerRef.current;
    if (!el || !video) return;

    // Try container fullscreen (desktop)
    const tryFullscreen = () => {
      const req =
        el.requestFullscreen?.bind(el) ||
        (el as any).webkitRequestFullscreen?.bind(el) ||
        (el as any).mozRequestFullScreen?.bind(el);
      if (req) req().catch(() => {});
    };

    // iOS Safari: use video element fullscreen
    const tryVideoFullscreen = () => {
      const enterFS = (video as any).webkitEnterFullscreen;
      if (enterFS) enterFS.call(video);
    };

    // Try after a small delay to let video start buffering first
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
      if (!fsEl) onClose();
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

    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setError('Não foi possível reproduzir este conteúdo.');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    if (useHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setError('Erro ao carregar stream.');
              hls.destroy();
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
        }, { once: true });
      }
    } else {
      // MP4 / direct video
      video.src = url;
      video.addEventListener('canplay', () => {
        video.play().catch(() => {});
      }, { once: true });
    }

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.src = '';
      video.load();
    };
  }, [url, useHls]);

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
        }}>
          <div style={{
            width: 48, height: 48, border: '4px solid rgba(255,255,255,0.2)',
            borderTopColor: '#e63946', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginTop: 16 }}>
            Carregando...
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'center', maxWidth: 300 }}>{error}</div>
          <button
            onClick={handleClose}
            style={{
              background: '#e63946', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontSize: '0.9rem',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            Voltar
          </button>
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
