import { useState, useMemo } from 'react';
import type { M3UItem } from '../../types';
import { groupByCategory, sortCategories, LIVE_CATEGORY_ORDER } from '../../utils';

interface LiveTvPageProps {
  title?: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
  onSearch?: () => void;
  favorites?: any[];
  onToggleFavorite?: (item: M3UItem) => void;
}

// Emoji flags for well-known category names
const CAT_ICONS: Record<string, string> = {
  'Brasil':        '🇧🇷',
  'Brasil 4K':     '🇧🇷',
  'Brasil 24h':    '🇧🇷',
  'Portugal':      '🇵🇹',
  'USA':           '🇺🇸',
  'França':        '🇫🇷',
  'Espanha':       '🇪🇸',
  'Argentina':     '🇦🇷',
  'Colômbia':      '🇨🇴',
  'Venezuela':     '🇻🇪',
  'México':        '🇲🇽',
  'Chile':         '🇨🇱',
  'Peru':          '🇵🇪',
  'Paraguai':      '🇵🇾',
  'Uruguai':       '🇺🇾',
  'R. Dominicana': '🇩🇴',
  'Bolívia':       '🇧🇴',
  'Cuba':          '🇨🇺',
  'NBA':           '🏀',
  'NBA ES':        '🏀',
  'Esportes':      '⚽',
  'Esportes PPV':  '🥊',
  'Documentários': '📽',
  'Infantil':      '🧸',
  'Notícias':      '📰',
  'Variedades':    '🎭',
  'Entretenimento':'📺',
  'Filmes ES':     '🎬',
  'Rádio':         '📻',
  'Câmeras':       '📷',
  'Adulto':        '🔞',
};

export default function LiveTvPage({
  title = 'TV ao Vivo',
  items,
  onBack,
  onPlay,
  onSearch,
  favorites = [],
  onToggleFavorite,
}: LiveTvPageProps) {
  const [showAdult, setShowAdult] = useState(false);

  const { groups, categories } = useMemo(() => {
    const raw = groupByCategory(items);
    const sorted = sortCategories(Object.keys(raw), LIVE_CATEGORY_ORDER);
    // Hide adult unless the user toggled it on
    const visible = showAdult ? sorted : sorted.filter(c => c !== 'Adulto');
    return { groups: raw, categories: visible };
  }, [items, showAdult]);

  const [selectedCat, setSelectedCat] = useState<string>('');
  // Pick initial/reset category when the list changes
  const activeCat = categories.includes(selectedCat) ? selectedCat : (categories[0] || '');

  const currentItems = groups[activeCat] || [];
  const hasAdult = Object.keys(groups).includes('Adulto');

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>{title}</h1>
        <span className="count">{items.length} canais</span>
        {hasAdult && (
          <button
            className={`adult-toggle-btn${showAdult ? ' active' : ''}`}
            onClick={() => setShowAdult(v => !v)}
            title={showAdult ? 'Ocultar conteúdo adulto' : 'Mostrar conteúdo adulto'}
            aria-pressed={showAdult}
          >
            🔞
          </button>
        )}
        {onSearch && (
          <button className="topbar-search-btn" onClick={onSearch} title="Buscar (/)">🔍</button>
        )}
      </div>
      <div className="content-layout">
        <div className="category-sidebar">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item${activeCat === cat ? ' active' : ''}${cat === 'Adulto' ? ' adult-cat' : ''}`}
              onClick={() => setSelectedCat(cat)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCat(cat); } }}
            >
              <span className="cat-icon">{CAT_ICONS[cat] ?? '📺'}</span>
              <span className="cat-name">{cat}</span>
              <span className="count">{groups[cat].length}</span>
            </div>
          ))}
        </div>
        <div className="channel-list">
          {currentItems.length === 0 ? (
            <div className="empty-state">
              <span>📺</span>
              <span>Nenhum canal disponível</span>
            </div>
          ) : (
            currentItems.map((item, idx) => (
              <div
                key={idx}
                className="channel-item"
                onClick={() => onPlay(item.url)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') onPlay(item.url); }}
              >
                <div className="channel-logo">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="placeholder">📺</span>
                  )}
                </div>
                <div className="channel-info">
                  <div className="channel-name">{item.name}</div>
                  <div className="channel-group">{item.group}</div>
                </div>
                {onToggleFavorite && (
                  <button
                    className={`fav-btn${favorites.some(f => f.itemName === item.name && f.itemType === item.type) ? ' active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
                    title="Favorito"
                    aria-label="Adicionar aos favoritos"
                  >
                    ❤️
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
