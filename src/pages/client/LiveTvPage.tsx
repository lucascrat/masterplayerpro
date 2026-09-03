import { useState, useMemo } from 'react';
import type { M3UItem } from '../../types';
import {
  groupByCategory,
  sortCategories,
  LIVE_CATEGORY_ORDER,
  deduplicateChannels,
  classifyChannelSubcategory,
  LIVE_SUBCATEGORY_ORDER,
  SUBCATEGORY_ICONS,
  type LiveSubcategory,
} from '../../utils';

interface LiveTvPageProps {
  title?: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string, item?: M3UItem) => void;
  onSearch?: () => void;
  favorites?: any[];
  onToggleFavorite?: (item: M3UItem) => void;
}

// Emoji flags for the sidebar categories
const CAT_ICONS: Record<string, string> = {
  'Brasil':        '🇧🇷', 'Brasil 4K': '🇧🇷', 'Brasil 24h': '🇧🇷',
  'Portugal':      '🇵🇹', 'USA': '🇺🇸', 'França': '🇫🇷', 'Espanha': '🇪🇸',
  'Argentina':     '🇦🇷', 'Colômbia': '🇨🇴', 'Venezuela': '🇻🇪',
  'México':        '🇲🇽', 'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Paraguai': '🇵🇾',
  'Uruguai':       '🇺🇾', 'R. Dominicana': '🇩🇴', 'Bolívia': '🇧🇴', 'Cuba': '🇨🇺',
  'NBA':           '🏀', 'NBA ES': '🏀', 'Esportes': '⚽', 'Esportes PPV': '🥊',
  'Documentários': '📽', 'Infantil': '🧸', 'Notícias': '📰', 'Variedades': '🎭',
  'Entretenimento':'📺', 'Filmes ES': '🎬', 'Rádio': '📻', 'Câmeras': '📷',
  'Adulto':        '🔞',
};

// Quality badge colors
const QUALITY_COLORS: Record<string, string> = {
  '4K': '#f59e0b', 'UHD': '#f59e0b',
  'FHD H265': '#10b981', 'FHD': '#10b981',
  'HD': '#3b82f6', 'SD': '#6b7280',
};

function getQualityColor(quality: string = ''): string {
  for (const [key, color] of Object.entries(QUALITY_COLORS)) {
    if (quality.toUpperCase().includes(key)) return color;
  }
  return '#6b7280';
}

function getShortQuality(quality: string = ''): string {
  const q = quality.toUpperCase();
  if (q.includes('4K') || q.includes('UHD')) return '4K';
  if (q.includes('FHD')) return 'FHD';
  if (q.includes('HD')) return 'HD';
  if (q.includes('SD')) return 'SD';
  return '';
}

// ── Quality picker sheet ─────────────────────────────────────────────────────
interface QualityPickerProps {
  item: M3UItem;
  onPlay: (url: string) => void;
  onClose: () => void;
}

function QualityPicker({ item, onPlay, onClose }: QualityPickerProps) {
  const variants = item.variants ?? [item];
  return (
    <div className="quality-picker-overlay" onClick={onClose}>
      <div className="quality-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="quality-picker-header">
          {item.logo && (
            <img src={item.logo} alt={item.name} className="quality-picker-logo"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div>
            <div className="quality-picker-title">{item.name}</div>
            <div className="quality-picker-sub">{variants.length} qualidade{variants.length !== 1 ? 's' : ''} disponível{variants.length !== 1 ? 'is' : ''}</div>
          </div>
        </div>
        <div className="quality-picker-options">
          {variants.map((v, i) => {
            const q = getShortQuality(v.quality ?? '');
            return (
              <button
                key={i}
                className="quality-option"
                onClick={() => { onClose(); onPlay(v.url); }}
              >
                {q && (
                  <span className="quality-badge" style={{ background: getQualityColor(v.quality ?? '') }}>
                    {q}
                  </span>
                )}
                <span className="quality-option-name">{v.name}</span>
                <span className="quality-play-icon">▶</span>
              </button>
            );
          })}
        </div>
        <button className="quality-picker-close" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
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
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [subCat, setSubCat] = useState<LiveSubcategory | 'all'>('all');
  const [qualityItem, setQualityItem] = useState<M3UItem | null>(null);
  const [deduplicate, setDeduplicate] = useState(true);

  // Build sorted groups, hide adult by default
  const { groups, categories } = useMemo(() => {
    const raw = groupByCategory(items);
    const sorted = sortCategories(Object.keys(raw), LIVE_CATEGORY_ORDER);
    const visible = showAdult ? sorted : sorted.filter(c => c !== 'Adulto');
    return { groups: raw, categories: visible };
  }, [items, showAdult]);

  const activeCat = categories.includes(selectedCat) ? selectedCat : (categories[0] ?? '');
  const hasAdult = Object.keys(groups).includes('Adulto');

  // Deduplicate + classify subcategories for the active category
  const { displayItems, availableSubcats } = useMemo(() => {
    const raw = groups[activeCat] ?? [];
    const deduped = deduplicate ? deduplicateChannels(raw) : raw;

    // Build subcategory map
    const subMap: Partial<Record<LiveSubcategory, M3UItem[]>> = {};
    for (const item of deduped) {
      const sub = classifyChannelSubcategory(item.name);
      if (!subMap[sub]) subMap[sub] = [];
      subMap[sub]!.push(item);
    }

    // Only show subcategories with at least 1 channel
    const available = LIVE_SUBCATEGORY_ORDER.filter(s => (subMap[s]?.length ?? 0) > 0);

    return { displayItems: deduped, availableSubcats: available, subMap };
  }, [groups, activeCat, deduplicate]);

  // Build subcategory map for filter
  const subMap = useMemo<Partial<Record<LiveSubcategory, M3UItem[]>>>(() => {
    const m: Partial<Record<LiveSubcategory, M3UItem[]>> = {};
    for (const item of displayItems) {
      const sub = classifyChannelSubcategory(item.name);
      if (!m[sub]) m[sub] = [];
      m[sub]!.push(item);
    }
    return m;
  }, [displayItems]);

  // Reset subCat when category changes
  const activeSubCat = availableSubcats.includes(subCat as LiveSubcategory) ? subCat : 'all';

  const currentItems = activeSubCat === 'all'
    ? displayItems
    : (subMap[activeSubCat as LiveSubcategory] ?? []);

  const handleChannelClick = (item: M3UItem) => {
    if (item.variants && item.variants.length > 1) {
      setQualityItem(item);
    } else {
      onPlay(item.url, item);
    }
  };

  const handleFav = (e: React.MouseEvent, item: M3UItem) => {
    e.stopPropagation();
    onToggleFavorite?.(item);
  };

  const showSubcats = availableSubcats.length > 1;

  return (
    <div className="content-page">
      {/* Quality picker modal */}
      {qualityItem && (
        <QualityPicker
          item={qualityItem}
          onPlay={url => onPlay(url)}
          onClose={() => setQualityItem(null)}
        />
      )}

      {/* Header */}
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>{title}</h1>
        <span className="count">{deduplicate ? displayItems.length : items.length} canais</span>

        {/* Dedup toggle */}
        <button
          className={`dedup-toggle-btn${deduplicate ? ' active' : ''}`}
          onClick={() => setDeduplicate(v => !v)}
          title={deduplicate ? 'Mostrar todas as qualidades' : 'Melhor qualidade apenas'}
        >
          {deduplicate ? 'HD+' : 'ALL'}
        </button>

        {hasAdult && (
          <button
            className={`adult-toggle-btn${showAdult ? ' active' : ''}`}
            onClick={() => setShowAdult(v => !v)}
            title={showAdult ? 'Ocultar adulto' : 'Mostrar adulto'}
            aria-pressed={showAdult}
          >🔞</button>
        )}
        {onSearch && (
          <button className="topbar-search-btn" onClick={onSearch} title="Buscar (/)">🔍</button>
        )}
      </div>

      <div className="content-layout">
        {/* Sidebar */}
        <div className="category-sidebar">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item${activeCat === cat ? ' active' : ''}${cat === 'Adulto' ? ' adult-cat' : ''}`}
              onClick={() => { setSelectedCat(cat); setSubCat('all'); }}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCat(cat); setSubCat('all'); } }}
            >
              <span className="cat-icon">{CAT_ICONS[cat] ?? '📺'}</span>
              <span className="cat-name">{cat}</span>
              <span className="count">{groups[cat].length}</span>
            </div>
          ))}
        </div>

        {/* Right: subcategory pills + channel list */}
        <div className="channel-list-wrapper">
          {/* Subcategory pills */}
          {showSubcats && (
            <div className="subcategory-pills">
              <button
                className={`subcat-pill${activeSubCat === 'all' ? ' active' : ''}`}
                onClick={() => setSubCat('all')}
              >
                Todos
                <span className="subcat-count">{displayItems.length}</span>
              </button>
              {availableSubcats.map(sub => (
                <button
                  key={sub}
                  className={`subcat-pill${activeSubCat === sub ? ' active' : ''}`}
                  onClick={() => setSubCat(sub)}
                >
                  <span>{SUBCATEGORY_ICONS[sub]}</span>
                  {sub}
                  <span className="subcat-count">{subMap[sub]?.length ?? 0}</span>
                </button>
              ))}
            </div>
          )}

          {/* Channel list */}
          <div className="channel-list">
            {currentItems.length === 0 ? (
              <div className="empty-state">
                <span>📺</span>
                <span>Nenhum canal disponível</span>
              </div>
            ) : (
              currentItems.map((item, idx) => {
                const isFav = favorites.some(f => f.itemName === stripQuality_local(item.name) && f.itemType === item.type);
                const hasVariants = (item.variants?.length ?? 0) > 1;
                const shortQ = getShortQuality(item.quality ?? '');

                return (
                  <div
                    key={idx}
                    className="channel-item"
                    onClick={() => handleChannelClick(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') handleChannelClick(item); }}
                  >
                    <div className="channel-logo">
                      {item.logo ? (
                        <img
                          src={item.logo}
                          alt={item.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span className="placeholder">📺</span>
                      )}
                    </div>
                    <div className="channel-info">
                      <div className="channel-name">{item.name}</div>
                      <div className="channel-group" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {shortQ && (
                          <span
                            className="quality-badge-inline"
                            style={{ background: getQualityColor(item.quality ?? '') }}
                          >{shortQ}</span>
                        )}
                        {hasVariants && (
                          <span className="quality-variants-hint">
                            {item.variants!.length} qualidades ▾
                          </span>
                        )}
                      </div>
                    </div>
                    {onToggleFavorite && (
                      <button
                        className={`fav-btn${isFav ? ' active' : ''}`}
                        onClick={e => handleFav(e, item)}
                        title="Favorito"
                      >❤️</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Local alias to strip quality for fav comparison without import cycle
function stripQuality_local(name: string): string {
  return name.replace(/\s+(?:\[H\.?265\]|(?:SD|HD|FHD|UHD|4K)(?:\s+(?:H\.?265|\[H\.?265\]|UHD|4K))?)$/i, '').trim();
}
