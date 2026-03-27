import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  url: string;
  onClose: () => void;
}

// Only treat actual HLS manifests as HLS (not bare .ts segments)
function isHlsUrl(url: string): boolean {
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.m3u8') || u.includes('/hls/');
}

// Try to upgrade HTTP stream to HTTPS (many IPTV providers support both)
function upgradeToHttps(url: string): string {
  if (url.startsWith('http://')) {
    return 'https://' + url.slice(7);
  }
  return url;
}

// Check if we have a mixed content situation
function isMixedContent(url: string): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    url.startsWith('http://')
  );
}

export default function HlsPlayer({ url, onClose }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsEnteredRef = useRef(false);

  // If mixed content: try HTTPS upgrade first
  const effectiveUrl = isMixedContent(url) ? upgradeToHttps(url) : url;
  const useHls = isHlsUrl(effectiveUrl);

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
      // Only auto-close if we actually entered fullscreen and user exited it
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

    // Clear previous timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Timeout: if still loading after 20s, show error
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Tempo limite excedido. O stream não respondeu a tempo.');
    }, 20000);

    const onPlaying = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
    };
    const onError = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      setError('Não foi possível reproduzir este conteúdo.\nVerifique sua conexão ou tente outro canal.');
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
          // Don't retry forever on network errors
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          fragLoadingMaxRetry: 2,
        });
        hlsRef.current = hls;
        hls.loadSource(effectiveUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setLoading(false);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // One retry attempt (might be transient)
              hls.startLoad();
              // If still failing after 10s, show error
              timeoutRef.current = setTimeout(() => {
                setError('Erro de rede: não foi possível carregar o stream.');
                hls.destroy();
              }, 10000);
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
        video.src = effectiveUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
        }, { once: true });
      }
    } else {
      // MP4 / direct video / IPTV direct stream
      // Try HLS.js first (handles many IPTV stream types)
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
          manifestLoadingMaxRetry: 1,
          levelLoadingMaxRetry: 1,
          fragLoadingMaxRetry: 1,
        });
        hlsRef.current = hls;
        hls.loadSource(effectiveUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            // HLS failed — fall back to native player
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
          background: 'rgba(0,0,0,0.6)',
        }}>
          <div style={{
            width: 52, height: 52, border: '4px solid rgba(255,255,255,0.15)',
            borderTopColor: '#e63946', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginTop: 16 }}>
            Carregando stream...
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: 6 }}>
            Aguarde até 20 segundos
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
            maxWidth: 320, lineHeight: 1.5, whiteSpace: 'pre-line',
          }}>{error}</div>
          {/* If mixed content was the issue, explain it */}
          {isMixedContent(url) && (
            <div style={{
              color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem',
              textAlign: 'center', maxWidth: 300,
            }}>
              Este stream usa HTTP. O app está tentando HTTPS automaticamente.
            </div>
          )}
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
