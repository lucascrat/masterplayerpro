import { useState } from 'react';
import type { M3UItem } from '../../types';
import { groupByCategory } from '../../utils';

interface LiveTvPageProps {
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
  onSearch?: () => void;
}

export default function LiveTvPage({ items, onBack, onPlay, onSearch }: LiveTvPageProps) {
  const groups = groupByCategory(items);
  const categories = Object.keys(groups);
  const [selectedCat, setSelectedCat] = useState(categories[0] || '');

  const currentItems = groups[selectedCat] || [];

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Live TV</h1>
        <span className="count">{items.length} channels</span>
        {onSearch && (
          <button className="topbar-search-btn" onClick={onSearch} title="Buscar (/)">🔍</button>
        )}
      </div>
      <div className="content-layout">
        <div className="category-sidebar">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item ${selectedCat === cat ? 'active' : ''}`}
              onClick={() => setSelectedCat(cat)}
            >
              <span>{cat}</span>
              <span className="count">{groups[cat].length}</span>
            </div>
          ))}
        </div>
        <div className="channel-list">
          {currentItems.length === 0 ? (
            <div className="empty-state">
              <span>📺</span>
              <span>No channels available</span>
            </div>
          ) : (
            currentItems.map((item, idx) => (
              <div key={idx} className="channel-item" onClick={() => onPlay(item.url)}>
                <div className="channel-logo">
                  {item.logo ? (
                    <img src={item.logo} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  ) : (
                    <span className="placeholder">📺</span>
                  )}
                </div>
                <div className="channel-info">
                  <div className="channel-name">{item.name}</div>
                  <div className="channel-group">{item.group}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
