import { useState } from 'react';
import type { PlaylistData } from '../../types';

interface SearchPageProps {
  playlist: PlaylistData | null;
  onBack: () => void;
  onPlay: (url: string) => void;
}

export default function SearchPage({ playlist, onBack, onPlay }: SearchPageProps) {
  const [query, setQuery] = useState('');

  const allItems = [
    ...(playlist?.live || []),
    ...(playlist?.movies || []),
    ...(playlist?.series || []),
  ];

  const filtered = query.length >= 2
    ? allItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Search</h1>
      </div>
      <div style={{ padding: '1.5rem' }}>
        <input
          className="search-input"
          type="text"
          placeholder="Search channels, movies, series..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <div style={{ marginTop: '1rem' }}>
          {filtered.length > 0 ? (
            filtered.slice(0, 50).map((item, idx) => (
              <div key={idx} className="channel-item" onClick={() => onPlay(item.url)}>
                <div className="channel-logo">
                  {item.logo ? (
                    <img src={item.logo} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  ) : (
                    <span className="placeholder">{item.type === 'live' ? '📺' : '🎬'}</span>
                  )}
                </div>
                <div className="channel-info">
                  <div className="channel-name">{item.name}</div>
                  <div className="channel-group">{item.group} • {item.type.toUpperCase()}</div>
                </div>
              </div>
            ))
          ) : query.length >= 2 ? (
            <div className="empty-state" style={{ height: '40vh' }}>
              <span>🔍</span>
              <span>No results for "{query}"</span>
            </div>
          ) : (
            <div className="empty-state" style={{ height: '40vh' }}>
              <span>🔍</span>
              <span>Type at least 2 characters to search</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
