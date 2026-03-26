import { useEffect, useRef, useState } from 'react';
import type { M3UItem } from '../types';

interface LazyMoviePosterProps {
  item: M3UItem;
}

export default function LazyMoviePoster({ item }: LazyMoviePosterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [poster, setPoster] = useState(item.logo || '');
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          observer.disconnect();
          const endpoint = item.type === 'series' ? '/api/tmdb/series' : '/api/tmdb/movie';
          fetch(`${endpoint}?name=${encodeURIComponent(item.name)}&lang=pt-BR`)
            .then(r => r.json())
            .then(data => {
              if (data?.poster) setPoster(data.poster);
            })
            .catch(() => {});
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [item.name, item.type]);

  return (
    <div ref={ref} className="movie-poster">
      {poster && !imgError ? (
        <img
          src={poster}
          alt={item.name}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
      ) : null}
      {(!poster || imgError || !loaded) && (
        <div className="placeholder" style={{ opacity: loaded ? 0 : 1, transition: 'opacity 0.3s ease', position: poster && !imgError ? 'absolute' : undefined, inset: 0 }}>
          <span>{item.type === 'series' ? '📺' : '🎬'}</span>
        </div>
      )}
    </div>
  );
}
