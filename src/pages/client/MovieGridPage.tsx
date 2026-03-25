import { useState, useEffect, useRef } from 'react';
import { M3UItem } from '../../types';
import { groupByCategory } from '../../utils';
import PosterImage from '../../components/PosterImage';

interface MovieGridPageProps {
  title: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
}

export default function MovieGridPage({ title, items, onBack, onPlay }: MovieGridPageProps) {
  const groups = groupByCategory(items);
  const categories = Object.keys(groups);
  const [selectedCat, setSelectedCat] = useState(categories[0] || '');
  const [visibleCount, setVisibleCount] = useState(50);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cats = Object.keys(groupByCategory(items));
    if (cats.length > 0 && !cats.includes(selectedCat)) {
      setSelectedCat(cats[0]);
    }
  }, [items]);

  const handleCatSelect = (cat: string) => {
    setSelectedCat(cat);
    setVisibleCount(50);
    gridRef.current?.scrollTo(0, 0);
  };

  const currentItems = groups[selectedCat] || [];
  const displayedItems = currentItems.slice(0, visibleCount);
  const hasMore = visibleCount < currentItems.length;

  return (
    <div className="content-page">
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
              <span>No content available</span>
            </div>
          ) : (
            <>
              {displayedItems.map((item, idx) => (
                <div key={idx} className="movie-card" onClick={() => onPlay(item.url)}>
                  <div className="movie-poster">
                    {item.logo ? (
                      <PosterImage src={item.logo} alt={item.name} />
                    ) : (
                      <div className="placeholder">
                        <span>🎬</span>
                        <span style={{ fontSize: '0.6rem', marginTop: '0.5rem', textAlign: 'center', padding: '0 5px' }}>{item.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="movie-title">{item.name}</div>
                </div>
              ))}
              {hasMore && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem' }}>
                  <button
                    onClick={() => setVisibleCount(v => v + 50)}
                    style={{
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '12px 24px', fontSize: '0.9rem',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Load More ({currentItems.length - visibleCount} remaining)
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
