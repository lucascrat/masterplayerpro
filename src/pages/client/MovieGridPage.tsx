import { useState, useEffect, useRef, useCallback } from 'react';
import type { M3UItem } from '../../types';
import { groupByCategory } from '../../utils';
import MovieDetail from '../../components/MovieDetail';

interface MovieGridPageProps {
  title: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
}

// Simple shimmer card while loading poster
function PosterSkeleton() {
  return (
    <div style={{
      width: '100%', aspectRatio: '2/3',
      background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      borderRadius: '8px 8px 0 0',
    }} />
  );
}

interface MovieCardProps {
  item: M3UItem;
  poster: string | null; // null = loading, '' = no poster
  onClick: () => void;
}

function MovieCard({ item, poster, onClick }: MovieCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const showPoster = poster && !imgError;

  return (
    <div className="movie-card" onClick={onClick}>
      <div className="movie-poster">
        {/* Skeleton shown while poster is loading or not yet fetched */}
        {(poster === null || (!imgLoaded && showPoster)) && <PosterSkeleton />}

        {showPoster && (
          <img
            src={poster}
            alt={item.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          />
        )}

        {/* No poster available */}
        {poster === '' && (
          <div className="placeholder">
            <span>{item.type === 'series' ? '📺' : '🎬'}</span>
          </div>
        )}
      </div>
      <div className="movie-title">{item.name}</div>
    </div>
  );
}

export default function MovieGridPage({ title, items, onBack, onPlay }: MovieGridPageProps) {
  const groups = groupByCategory(items);
  const categories = Object.keys(groups);
  const [selectedCat, setSelectedCat] = useState(categories[0] || '');
  const [visibleCount, setVisibleCount] = useState(24);
  const [selectedItem, setSelectedItem] = useState<M3UItem | null>(null);
  // posters map: itemName → posterUrl. undefined = not fetched yet, '' = no poster found
  const [posters, setPosters] = useState<Record<string, string>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(new Set<string>());

  // Sync selected category when items change
  useEffect(() => {
    const cats = Object.keys(groupByCategory(items));
    if (cats.length > 0 && !cats.includes(selectedCat)) {
      setSelectedCat(cats[0]);
    }
  }, [items]);

  const currentItems = groups[selectedCat] || [];
  const displayedItems = currentItems.slice(0, visibleCount);

  // Fetch posters for displayed items that haven't been fetched yet
  const fetchPosters = useCallback(async (itemsToFetch: M3UItem[]) => {
    const pending = itemsToFetch.filter(
      item => posters[item.name] === undefined && !fetchingRef.current.has(item.name)
    );
    if (!pending.length) return;

    // Mark as fetching
    pending.forEach(item => fetchingRef.current.add(item.name));

    try {
      const response = await fetch('/api/tmdb/posters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: pending.map(item => ({ name: item.name, type: item.type }))
        }),
      });
      const data: Record<string, string> = await response.json();

      setPosters(prev => {
        const next = { ...prev };
        for (const item of pending) {
          next[item.name] = data[item.name] || item.logo || '';
        }
        return next;
      });
    } catch {
      // On error, fall back to logo or empty
      setPosters(prev => {
        const next = { ...prev };
        for (const item of pending) {
          next[item.name] = item.logo || '';
        }
        return next;
      });
    } finally {
      pending.forEach(item => fetchingRef.current.delete(item.name));
    }
  }, [posters]);

  useEffect(() => {
    if (displayedItems.length > 0) {
      fetchPosters(displayedItems);
    }
  }, [displayedItems.map(i => i.name).join(',')]);

  const handleCatSelect = (cat: string) => {
    setSelectedCat(cat);
    setVisibleCount(24);
    gridRef.current?.scrollTo(0, 0);
  };

  const hasMore = visibleCount < currentItems.length;

  return (
    <div className="content-page">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {selectedItem && (
        <MovieDetail
          item={selectedItem}
          onPlay={(url) => { setSelectedItem(null); onPlay(url); }}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>{title}</h1>
        <span className="count">{items.length} items</span>
      </div>

      <div className="content-layout">
        <div className="category-sidebar">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item ${selectedCat === cat ? 'active' : ''}`}
              onClick={() => handleCatSelect(cat)}
            >
              <span>{cat}</span>
              <span className="count">{groups[cat].length}</span>
            </div>
          ))}
        </div>

        <div className="movie-grid" ref={gridRef}>
          {displayedItems.length === 0 ? (
            <div className="empty-state">
              <span>🎬</span>
              <span>Nenhum conteúdo disponível</span>
            </div>
          ) : (
            <>
              {displayedItems.map((item, idx) => (
                <MovieCard
                  key={`${selectedCat}-${idx}`}
                  item={item}
                  poster={posters[item.name] !== undefined ? posters[item.name] : null}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
              {hasMore && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem' }}>
                  <button
                    onClick={() => setVisibleCount(v => v + 24)}
                    style={{
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '12px 32px', fontSize: '0.9rem',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Carregar mais ({currentItems.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
