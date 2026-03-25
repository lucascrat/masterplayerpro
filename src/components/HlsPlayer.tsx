import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  url: string;
  onClose: () => void;
}

// Detect if URL needs HLS.js (m3u8) or can be played natively (mp4/mkv/etc)
function isHlsUrl(url: string): boolean {
  const u = url.toLowerCase().split('?')[0];
  return u.endsWith('.m3u8') || u.endsWith('.ts') || u.includes('/hls/');
}

export default function HlsPlayer({ url, onClose }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const useHls = isHlsUrl(url);

  // Auto fullscreen when player opens
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const req =
      el.requestFullscreen?.bind(el) ||
      (el as any).webkitRequestFullscreen?.bind(el) ||
      (el as any).mozRequestFullScreen?.bind(el);
    if (req) req().catch(() => {});

    const onFsChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsEl) onClose();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (useHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: hls.destroy(); break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => {});
          const enterFS = (video as any).webkitEnterFullscreen;
          if (enterFS) enterFS.call(video);
        });
      }
    } else {
      video.src = url;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }
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
        autoPlay
        playsInline
      />
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
    </div>
  );
}
