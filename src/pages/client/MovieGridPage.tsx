import { useState, useEffect, useRef, useMemo } from 'react';
import type { M3UItem } from '../../types';
import { groupByCategory, groupSeriesByShow } from '../../utils';
import MovieDetail from '../../components/MovieDetail';
import SeriesDetail from '../../components/SeriesDetail';

interface MovieGridPageProps {
  title: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
}

// ── Batch poster fetch ──────────────────────────────────────────────
async function fetchBatchPosters(items: M3UItem[]): Promise<Record<string, string>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const res = await fetch('/api/tmdb/posters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(i => ({ name: i.name, type: i.type })) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.json();
  } catch {
    return {};
  }
}

// ── Skeleton shimmer ────────────────────────────────────────────────
function Skeleton({ style }: { style?: React.CSSProperties }) {
  return <div className="nf-skeleton" style={style} />;
}

// ── Hero Section ────────────────────────────────────────────────────
interface HeroProps {
  item: M3UItem;
  onPlay: () => void;
  onInfo: () => void;
}

function HeroSection({ item, onPlay, onInfo }: HeroProps) {
  const [data, setData] = useState<{
    backdrop: string; poster: string; overview: string; title: string; rating: number; year: string;
  } | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    setData(null);
    setBgLoaded(false);
    const ep = item.type === 'series' ? '/api/tmdb/series' : '/api/tmdb/movie';
    fetch(`${ep}?name=${encodeURIComponent(item.name)}&lang=pt-BR`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [item.name, item.type]);

  const bg = data?.backdrop || data?.poster || item.logo || '';
  const displayTitle = data?.title || item.name;
  const overview = data?.overview || '';
  const rating = data?.rating;
  const year = data?.year || '';

  return (
    <div className="nf-hero">
      {bg ? (
        <img
          src={bg}
          alt=""
          className="nf-hero-bg"
          onLoad={() => setBgLoaded(true)}
          style={{ opacity: bgLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
        />
      ) : (
        <div className="nf-hero-bg nf-hero-bg-placeholder" />
      )}
      <div className="nf-hero-overlay" />
      <div className="nf-hero-content">
        <div className="nf-hero-meta">
          {rating && rating > 0 && (
            <span className="nf-hero-rating">★ {rating.toFixed(1)}</span>
          )}
          {year && <span className="nf-hero-year">{year}</span>}
        </div>
        <h1 className="nf-hero-title">{displayTitle}</h1>
        {overview && <p className="nf-hero-overview">{overview}</p>}
        <div className="nf-hero-buttons">
          <button className="nf-btn-play" onClick={onPlay}>▶ Assistir</button>
          <button className="nf-btn-info" onClick={onInfo}>ℹ Mais info</button>
        </div>
      </div>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────
interface NfCardProps {
  item: M3UItem;
  poster: string | null; // null=loading, ''=no poster
  rank?: number;
  onClick: () => void;
}

function NfCard({ item, poster, rank, onClick }: NfCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset on poster change
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [poster]);

  const showImg = poster && !error;

  return (
    <div className={`nf-card${rank ? ' nf-card-top10' : ''}`} onClick={onClick}>
      {rank && <span className="nf-card-rank">{rank}</span>}
      <div className="nf-card-poster">
        {/* Skeleton while loading */}
        {(poster === null || (!loaded && showImg)) && (
          <Skeleton style={{ position: 'absolute', inset: 0, borderRadius: 6 }} />
        )}
        {/* Poster image */}
        {showImg && (
          <img
            src={poster}
            alt={item.name}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.35s ease' }}
          />
        )}
        {/* No poster fallback — show when poster is empty OR image failed to load */}
        {(poster === '' || error) && (
          <div className="nf-card-placeholder">
            {item.type === 'series' ? '📺' : '🎬'}
          </div>
        )}
        <div className="nf-card-hover-overlay">▶</div>
      </div>
      <div className="nf-card-title">{item.name}</div>
    </div>
  );
}

// ── Content Row ─────────────────────────────────────────────────────
interface RowProps {
  rowTitle: string;
  items: M3UItem[];
  isTop10?: boolean;
  onCardClick: (item: M3UItem) => void;
}

function ContentRow({ rowTitle, items, isTop10 = false, onCardClick }: RowProps) {
  const [posters, setPosters] = useState<Record<string, string>>({});
  const rowRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  const displayItems = isTop10 ? items.slice(0, 10) : items.slice(0, 40);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    // IntersectionObserver works correctly on ROWS (full-width elements in page flow)
    // unlike individual cards inside a scroll container
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !fetchedRef.current) {
        fetchedRef.current = true;
        observer.disconnect();
        fetchBatchPosters(displayItems).then(data => {
          setPosters(prev => {
            const next = { ...prev, ...data };
            // Mark every item as resolved — if TMDB has no result, fall back to
            // the M3U tvg-logo, or '' so the card shows the emoji placeholder
            // instead of staying in skeleton state forever
            for (const item of displayItems) {
              if (next[item.name] === undefined) {
                next[item.name] = item.logo || '';
              }
            }
            return next;
          });
        }).catch(() => {
          // Network error: resolve all with M3U logo or empty
          setPosters(prev => {
            const next = { ...prev };
            for (const item of displayItems) {
              if (next[item.name] === undefined) next[item.name] = item.logo || '';
            }
            return next;
          });
        });
      }
    }, { rootMargin: '300px 0px' });

    observer.observe(el);
    return () => observer.disconnect();
  }, [rowTitle]);

  return (
    <div className="nf-row" ref={rowRef}>
      <h2 className="nf-row-title">{rowTitle}</h2>
      <div className="nf-row-scroll">
        {displayItems.map((item, idx) => (
          <NfCard
            key={`${item.name}-${idx}`}
            item={item}
            poster={posters[item.name] !== undefined ? posters[item.name] : null}
            rank={isTop10 ? idx + 1 : undefined}
            onClick={() => onCardClick(item)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────
export default function MovieGridPage({ title, items, onBack, onPlay }: MovieGridPageProps) {
  const [selectedItem, setSelectedItem] = useState<M3UItem | null>(null);
  const [selectedShow, setSelectedShow] = useState<{ name: string; episodes: M3UItem[] } | null>(null);

  const isSeriesMode = title === 'Series' || items.some(i => /S\d{1,2}\s*[xXeE]\d{1,2}/i.test(i.name));

  // Build display groups:
  // - Movies: group by category → M3UItem[]
  // - Series: group by category → group by show → one virtual M3UItem per show
  const { displayGroups, showEpisodesMap } = useMemo(() => {
    const episodesMap: Record<string, M3UItem[]> = {};
    const catGroups = groupByCategory(items);
    const dGroups: Record<string, M3UItem[]> = {};

    if (isSeriesMode) {
      for (const [cat, catItems] of Object.entries(catGroups)) {
        const byShow = groupSeriesByShow(catItems);
        dGroups[cat] = Object.entries(byShow).map(([showName, eps]) => {
          episodesMap[showName] = eps;
          // Virtual item representing the show
          return {
            name: showName,
            logo: eps[0]?.logo || '',
            group: cat,
            url: eps[0]?.url || '',
            type: 'series' as const,
          };
        });
      }
    } else {
      Object.assign(dGroups, catGroups);
    }

    return { displayGroups: dGroups, showEpisodesMap: episodesMap };
  }, [items, isSeriesMode]);

  const categories = Object.keys(displayGroups);

  // Hero: for series prefer "novidades/lançamento/destaque", for movies prefer "lançamentos"
  const heroCategory = isSeriesMode
    ? (categories.find(c => /novidade|destaque|novo|recente|lança/i.test(c)) || categories[0] || '')
    : (categories.find(c => /lança/i.test(c)) || categories.find(c => /cinema|destaque|novo/i.test(c)) || categories[0] || '');

  const heroItem = displayGroups[heroCategory]?.[0] || items[0];
  const top10Items = displayGroups[heroCategory] || [];
  const otherCategories = categories.filter(c => c !== heroCategory);

  const handleCardClick = (item: M3UItem) => {
    if (isSeriesMode && showEpisodesMap[item.name]) {
      setSelectedShow({ name: item.name, episodes: showEpisodesMap[item.name] });
    } else {
      setSelectedItem(item);
    }
  };

  // Hero click for series shows the series detail
  const handleHeroPlay = () => {
    if (isSeriesMode && heroItem && showEpisodesMap[heroItem.name]) {
      const eps = showEpisodesMap[heroItem.name];
      onPlay(eps[0]?.url || heroItem.url);
    } else if (heroItem) {
      onPlay(heroItem.url);
    }
  };

  const handleHeroInfo = () => {
    if (heroItem) {
      if (isSeriesMode && showEpisodesMap[heroItem.name]) {
        setSelectedShow({ name: heroItem.name, episodes: showEpisodesMap[heroItem.name] });
      } else {
        setSelectedItem(heroItem);
      }
    }
  };

  // Count unique shows (series) or individual items (movies)
  const totalCount = isSeriesMode ? Object.keys(showEpisodesMap).length : items.length;

  if (!items.length) {
    return (
      <div className="nf-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{isSeriesMode ? '📺' : '🎬'}</div>
          <div>Nenhum conteúdo disponível</div>
        </div>
      </div>
    );
  }

  return (
    <div className="nf-page">
      {/* Fixed top bar */}
      <div className="nf-topbar">
        <button className="nf-back-btn" onClick={onBack}>←</button>
        <span className="nf-page-title">{title}</span>
        <span className="nf-topbar-count">
          {totalCount} {isSeriesMode ? 'séries' : 'títulos'}
          {isSeriesMode && ` · ${items.length} ep`}
        </span>
      </div>

      {/* Hero */}
      {heroItem && (
        <HeroSection
          item={heroItem}
          onPlay={handleHeroPlay}
          onInfo={handleHeroInfo}
        />
      )}

      {/* Rows */}
      <div className="nf-rows">
        {top10Items.length >= 3 && (
          <ContentRow
            rowTitle={isSeriesMode ? '🔥 Top 10 Séries' : '🔥 Top 10'}
            items={top10Items}
            isTop10
            onCardClick={handleCardClick}
          />
        )}
        {otherCategories.map(cat => (
          <ContentRow
            key={cat}
            rowTitle={cat}
            items={displayGroups[cat]}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      {/* Movie detail modal */}
      {selectedItem && (
        <MovieDetail
          item={selectedItem}
          onPlay={(url) => { setSelectedItem(null); onPlay(url); }}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Series detail modal (seasons + episodes) */}
      {selectedShow && (
        <SeriesDetail
          showName={selectedShow.name}
          episodes={selectedShow.episodes}
          onPlay={(url) => { setSelectedShow(null); onPlay(url); }}
          onClose={() => setSelectedShow(null)}
        />
      )}
    </div>
  );
}
