import { useState, useMemo, useEffect, useRef } from 'react';
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

// ── Poster card (fetches TMDB poster) ──────────────────────────────
interface PosterCardProps {
  item: M3UItem;
  onClick: () => void;
}

function PosterCard({ item, onClick }: PosterCardProps) {
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
        {/* Skeleton */}
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
      <div className="search-card-title">{item.name}</div>
    </div>
  );
}

// ── Channel row ─────────────────────────────────────────────────────
interface ChannelRowProps {
  item: M3UItem;
  onClick: () => void;
}

function ChannelRow({ item, onClick }: ChannelRowProps) {
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
        <div className="search-channel-name">{item.name}</div>
        <div className="search-channel-group">{item.group}</div>
      </div>
      <div className="search-channel-play">▶</div>
    </div>
  );
}

// ── Section header ──────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="search-section-header">
      <span className="search-section-label">{label}</span>
      <span className="search-section-count">{count}</span>
    </div>
  );
}

// ── Main SearchPage ─────────────────────────────────────────────────
export default function SearchPage({ playlist, onBack, onPlay }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedMovie, setSelectedMovie] = useState<M3UItem | null>(null);
  const [selectedShow, setSelectedShow] = useState<{ name: string; episodes: M3UItem[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.trim().toLowerCase();

  // Search results computed from query
  const results = useMemo(() => {
    if (q.length < 2) return { live: [], movies: [], shows: [] as { item: M3UItem; episodes: M3UItem[] }[] };

    const live = (playlist?.live || []).filter(i => i.name.toLowerCase().includes(q));
    const movies = (playlist?.movies || []).filter(i => i.name.toLowerCase().includes(q));

    // For series: find matching episodes, group by show, show unique shows
    const matchingEpisodes = (playlist?.series || []).filter(i =>
      i.name.toLowerCase().includes(q) || extractShowName(i.name).toLowerCase().includes(q)
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
  }, [q, playlist]);

  const totalResults = results.live.length + results.movies.length + results.shows.length;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',    label: 'Todos',   count: totalResults },
    { key: 'live',   label: '📡 Canais', count: results.live.length },
    { key: 'movie',  label: '🎬 Filmes', count: results.movies.length },
    { key: 'series', label: '📺 Séries', count: results.shows.length },
  ];

  const showLive   = (filter === 'all' || filter === 'live')   && results.live.length > 0;
  const showMovies = (filter === 'all' || filter === 'movie')  && results.movies.length > 0;
  const showSeries = (filter === 'all' || filter === 'series') && results.shows.length > 0;

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
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      {q.length >= 2 && (
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
        {q.length < 2 ? (
          /* Empty state — before search */
          <div className="search-empty">
            <div className="search-empty-icon">🔍</div>
            <div className="search-empty-title">Busque qualquer conteúdo</div>
            <div className="search-empty-sub">Canais ao vivo, filmes e séries da sua lista</div>
          </div>
        ) : totalResults === 0 ? (
          /* No results */
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
                  {results.live.slice(0, 30).map((item, idx) => (
                    <ChannelRow key={idx} item={item} onClick={() => onPlay(item.url)} />
                  ))}
                  {results.live.length > 30 && (
                    <div className="search-more">+{results.live.length - 30} canais não exibidos — refine a busca</div>
                  )}
                </div>
              </div>
            )}

            {/* Movies */}
            {showMovies && (
              <div className="search-section">
                <SectionHeader label="🎬 Filmes" count={results.movies.length} />
                <div className="search-poster-grid">
                  {results.movies.slice(0, 40).map((item, idx) => (
                    <PosterCard key={idx} item={item} onClick={() => setSelectedMovie(item)} />
                  ))}
                </div>
                {results.movies.length > 40 && (
                  <div className="search-more">+{results.movies.length - 40} filmes — refine a busca</div>
                )}
              </div>
            )}

            {/* Series */}
            {showSeries && (
              <div className="search-section">
                <SectionHeader label="📺 Séries" count={results.shows.length} />
                <div className="search-poster-grid">
                  {results.shows.slice(0, 40).map(({ item, episodes }, idx) => (
                    <PosterCard
                      key={idx}
                      item={item}
                      onClick={() => setSelectedShow({ name: item.name, episodes })}
                    />
                  ))}
                </div>
                {results.shows.length > 40 && (
                  <div className="search-more">+{results.shows.length - 40} séries — refine a busca</div>
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
