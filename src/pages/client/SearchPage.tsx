import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { M3UItem, PlaylistData } from '../../types';
import { extractShowName, groupSeriesByShow } from '../../utils';
import MovieDetail from '../../components/MovieDetail';
import SeriesDetail from '../../components/SeriesDetail';

interface SearchPageProps {
  playlist: PlaylistData | null;
  onBack: () => void;
  onPlay: (url: string) => void;
}

type FilterType = 'all' | 'live' | 'movie' | 'series';

const HISTORY_KEY = 'krator_search_history';
const MAX_HISTORY = 8;

// ── Local storage helpers ────────────────────────────────────────────
function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: string[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {}
}
function addToHistory(term: string) {
  if (!term.trim() || term.trim().length < 2) return;
  const h = loadHistory().filter(x => x.toLowerCase() !== term.toLowerCase());
  saveHistory([term.trim(), ...h].slice(0, MAX_HISTORY));
}

// ── Highlight matching text ──────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(139,92,246,0.45)', color: '#fff', borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Poster card ──────────────────────────────────────────────────────
interface PosterCardProps {
  item: M3UItem;
  query: string;
  onClick: () => void;
}

function PosterCard({ item, query, onClick }: PosterCardProps) {
  const [poster, setPoster] = useState(item.logo || '');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !item.name) return;
    fetchedRef.current = true;
    const ep = item.type === 'series' ? '/api/tmdb/series' : '/api/tmdb/movie';
    fetch(`${ep}?name=${encodeURIComponent(item.name)}&lang=pt-BR`)
      .then(r => r.json())
      .then(data => { if (data?.poster) { setPoster(data.poster); setLoaded(false); setError(false); } })
      .catch(() => {});
  }, [item.name, item.type]);

  const showImg = poster && !error;

  return (
    <div className="search-card" onClick={onClick}>
      <div className="search-card-poster">
        {!loaded && showImg && <div className="nf-skeleton" style={{ position: 'absolute', inset: 0 }} />}
        {showImg && (
          <img
            src={poster}
            alt={item.name}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          />
        )}
        {(!poster || error) && (
          <div className="search-card-placeholder">
            {item.type === 'series' ? '📺' : '🎬'}
          </div>
        )}
        <div className="search-card-overlay">▶</div>
      </div>
      <div className="search-card-title">
        <Highlight text={item.name} query={query} />
      </div>
    </div>
  );
}

// ── Channel row ──────────────────────────────────────────────────────
interface ChannelRowProps {
  item: M3UItem;
  query: string;
  onClick: () => void;
}

function ChannelRow({ item, query, onClick }: ChannelRowProps) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="search-channel-row" onClick={onClick}>
      <div className="search-channel-logo">
        {item.logo && !imgError ? (
          <img src={item.logo} alt={item.name} onError={() => setImgError(true)} />
        ) : (
          <span>📡</span>
        )}
      </div>
      <div className="search-channel-info">
        <div className="search-channel-name"><Highlight text={item.name} query={query} /></div>
        <div className="search-channel-group">{item.group}</div>
      </div>
      <div className="search-channel-play">▶</div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="search-section-header">
      <span className="search-section-label">{label}</span>
      <span className="search-section-count">{count}</span>
    </div>
  );
}

// ── Recent searches / empty state ────────────────────────────────────
interface EmptyStateProps {
  history: string[];
  onHistoryClick: (term: string) => void;
  onHistoryClear: () => void;
  playlist: PlaylistData | null;
  onCategoryClick: (filter: FilterType) => void;
}

function EmptyState({ history, onHistoryClick, onHistoryClear, playlist, onCategoryClick }: EmptyStateProps) {
  const counts = {
    live: playlist?.live.length || 0,
    movie: playlist?.movies.length || 0,
    series: playlist?.series.length || 0,
  };

  return (
    <div className="search-empty-state">
      {/* Recent searches */}
      {history.length > 0 && (
        <div className="search-history-section">
          <div className="search-history-header">
            <span>Buscas recentes</span>
            <button className="search-history-clear" onClick={onHistoryClear}>Limpar</button>
          </div>
          <div className="search-history-list">
            {history.map((term, i) => (
              <button key={i} className="search-history-item" onClick={() => onHistoryClick(term)}>
                <span className="search-history-icon">🕐</span>
                <span className="search-history-text">{term}</span>
                <span className="search-history-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick category access */}
      <div className="search-categories-section">
        <div className="search-categories-title">Explorar por tipo</div>
        <div className="search-categories-grid">
          <button className="search-cat-btn search-cat-live" onClick={() => onCategoryClick('live')}>
            <span className="search-cat-icon">📡</span>
            <span className="search-cat-label">Canais ao Vivo</span>
            <span className="search-cat-count">{counts.live.toLocaleString()}</span>
          </button>
          <button className="search-cat-btn search-cat-movie" onClick={() => onCategoryClick('movie')}>
            <span className="search-cat-icon">🎬</span>
            <span className="search-cat-label">Filmes</span>
            <span className="search-cat-count">{counts.movie.toLocaleString()}</span>
          </button>
          <button className="search-cat-btn search-cat-series" onClick={() => onCategoryClick('series')}>
            <span className="search-cat-icon">📺</span>
            <span className="search-cat-label">Séries</span>
            <span className="search-cat-count">{counts.series.toLocaleString()}</span>
          </button>
        </div>
      </div>

      {history.length === 0 && (
        <div className="search-hint">
          <div className="search-hint-icon">🔍</div>
          <div className="search-hint-text">Busque canais, filmes e séries</div>
          <div className="search-hint-sub">Digite pelo menos 2 caracteres para buscar</div>
        </div>
      )}
    </div>
  );
}

// ── Main SearchPage ──────────────────────────────────────────────────
export default function SearchPage({ playlist, onBack, onPlay }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedMovie, setSelectedMovie] = useState<M3UItem | null>(null);
  const [selectedShow, setSelectedShow] = useState<{ name: string; episodes: M3UItem[] } | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();

  // Debounced history save
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        addToHistory(query.trim());
        setHistory(loadHistory());
      }, 1500);
    }
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [q, query]);

  const handleHistoryClick = useCallback((term: string) => {
    setQuery(term);
    setFilter('all');
    inputRef.current?.focus();
  }, []);

  const handleHistoryClear = useCallback(() => {
    saveHistory([]);
    setHistory([]);
  }, []);

  const handleCategoryClick = useCallback((f: FilterType) => {
    setFilter(f);
    setQuery('*'); // Show all in this category
    inputRef.current?.focus();
  }, []);

  // Search results
  const results = useMemo(() => {
    // '*' = show all (from category buttons)
    const isWildcard = query.trim() === '*';

    if (!isWildcard && q.length < 2) {
      return { live: [], movies: [], shows: [] as { item: M3UItem; episodes: M3UItem[] }[] };
    }

    const match = (name: string) => isWildcard || name.toLowerCase().includes(q);

    const live = (playlist?.live || []).filter(i => match(i.name));
    const movies = (playlist?.movies || []).filter(i => match(i.name));

    const matchingEpisodes = (playlist?.series || []).filter(i =>
      match(i.name) || match(extractShowName(i.name))
    );
    const byShow = groupSeriesByShow(matchingEpisodes);
    const shows = Object.entries(byShow).map(([showName, episodes]) => ({
      item: {
        name: showName,
        logo: episodes[0]?.logo || '',
        group: episodes[0]?.group || '',
        url: episodes[0]?.url || '',
        type: 'series' as const,
      },
      episodes,
    }));

    return { live, movies, shows };
  }, [q, query, playlist]);

  const totalResults = results.live.length + results.movies.length + results.shows.length;
  const isWildcard = query.trim() === '*';
  const hasQuery = isWildcard || q.length >= 2;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',    label: 'Todos',     count: totalResults },
    { key: 'live',   label: '📡 Canais', count: results.live.length },
    { key: 'movie',  label: '🎬 Filmes', count: results.movies.length },
    { key: 'series', label: '📺 Séries', count: results.shows.length },
  ];

  const showLive   = (filter === 'all' || filter === 'live')   && results.live.length > 0;
  const showMovies = (filter === 'all' || filter === 'movie')  && results.movies.length > 0;
  const showSeries = (filter === 'all' || filter === 'series') && results.shows.length > 0;

  const displayQuery = isWildcard ? '' : query;

  return (
    <div className="search-page">
      {/* Header */}
      <div className="search-header">
        <button className="nf-back-btn" onClick={onBack} style={{ flexShrink: 0 }}>←</button>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            className="search-input-field"
            type="text"
            placeholder="Buscar canais, filmes, séries..."
            value={isWildcard ? '' : query}
            onChange={e => { setQuery(e.target.value); setFilter('all'); }}
            onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setFilter('all'); } }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button className="search-clear" onClick={() => { setQuery(''); setFilter('all'); inputRef.current?.focus(); }}>✕</button>
          )}
        </div>
      </div>

      {/* Filter pills — shown when there are results */}
      {hasQuery && totalResults > 0 && (
        <div className="search-filters">
          {filters.map(f => (
            <button
              key={f.key}
              className={`search-filter-pill ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.count > 0 && <span className="search-filter-count">{f.count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="search-results">
        {!hasQuery ? (
          <EmptyState
            history={history}
            onHistoryClick={handleHistoryClick}
            onHistoryClear={handleHistoryClear}
            playlist={playlist}
            onCategoryClick={handleCategoryClick}
          />
        ) : totalResults === 0 ? (
          <div className="search-empty">
            <div className="search-empty-icon">😕</div>
            <div className="search-empty-title">Nenhum resultado</div>
            <div className="search-empty-sub">Nada encontrado para "{query}"</div>
          </div>
        ) : (
          <>
            {/* Live channels */}
            {showLive && (
              <div className="search-section">
                <SectionHeader label="📡 Canais ao Vivo" count={results.live.length} />
                <div className="search-channel-list">
                  {results.live.slice(0, 50).map((item, idx) => (
                    <ChannelRow key={idx} item={item} query={displayQuery} onClick={() => onPlay(item.url)} />
                  ))}
                  {results.live.length > 50 && (
                    <div className="search-more">+{results.live.length - 50} canais — refine a busca</div>
                  )}
                </div>
              </div>
            )}

            {/* Movies */}
            {showMovies && (
              <div className="search-section">
                <SectionHeader label="🎬 Filmes" count={results.movies.length} />
                <div className="search-poster-grid">
                  {results.movies.slice(0, 60).map((item, idx) => (
                    <PosterCard key={idx} item={item} query={displayQuery} onClick={() => setSelectedMovie(item)} />
                  ))}
                </div>
                {results.movies.length > 60 && (
                  <div className="search-more">+{results.movies.length - 60} filmes — refine a busca</div>
                )}
              </div>
            )}

            {/* Series */}
            {showSeries && (
              <div className="search-section">
                <SectionHeader label="📺 Séries" count={results.shows.length} />
                <div className="search-poster-grid">
                  {results.shows.slice(0, 60).map(({ item, episodes }, idx) => (
                    <PosterCard
                      key={idx}
                      item={item}
                      query={displayQuery}
                      onClick={() => setSelectedShow({ name: item.name, episodes })}
                    />
                  ))}
                </div>
                {results.shows.length > 60 && (
                  <div className="search-more">+{results.shows.length - 60} séries — refine a busca</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Movie detail modal */}
      {selectedMovie && (
        <MovieDetail
          item={selectedMovie}
          onPlay={(url) => { setSelectedMovie(null); onPlay(url); }}
          onClose={() => setSelectedMovie(null)}
        />
      )}

      {/* Series detail modal */}
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
