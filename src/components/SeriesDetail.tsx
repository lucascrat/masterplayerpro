import { useEffect, useState } from 'react';
import type { M3UItem } from '../types';
import { parseEpisodeInfo } from '../utils';

interface TMDBData {
  title: string;
  overview: string;
  rating: number;
  year: string;
  genres: string[];
  poster: string;
  backdrop: string;
}

interface SeasonGroup {
  season: number;
  episodes: M3UItem[];
}

function groupBySeasons(episodes: M3UItem[]): SeasonGroup[] {
  const seasons: Record<number, M3UItem[]> = {};
  for (const ep of episodes) {
    const info = parseEpisodeInfo(ep.name);
    const s = info?.season ?? 1;
    if (!seasons[s]) seasons[s] = [];
    seasons[s].push(ep);
  }
  return Object.entries(seasons)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([season, eps]) => ({ season: Number(season), episodes: eps }));
}

interface SeriesDetailProps {
  showName: string;
  episodes: M3UItem[];
  onPlay: (url: string) => void;
  onClose: () => void;
}

export default function SeriesDetail({ showName, episodes, onPlay, onClose }: SeriesDetailProps) {
  const [tmdb, setTmdb] = useState<TMDBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSeason, setOpenSeason] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tmdb/series?name=${encodeURIComponent(showName)}&lang=pt-BR`)
      .then(r => r.json())
      .then(data => { setTmdb(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [showName]);

  const seasons = groupBySeasons(episodes);

  // Auto-open first season
  useEffect(() => {
    if (seasons.length > 0 && openSeason === null) {
      setOpenSeason(seasons[0].season);
    }
  }, [seasons.length]);

  const poster = tmdb?.poster || episodes[0]?.logo || '';
  const backdrop = tmdb?.backdrop || '';
  const title = tmdb?.title || showName;
  const overview = tmdb?.overview || '';
  const rating = tmdb?.rating;
  const year = tmdb?.year || '';
  const genres = tmdb?.genres || [];

  return (
    <div
      onClick={onClose}
      onTouchEnd={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        style={{
          background: '#181818',
          borderRadius: 16,
          overflow: 'hidden',
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 30px 80px rgba(0,0,0,0.9)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Backdrop */}
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', overflow: 'hidden', flexShrink: 0 }}>
          {backdrop && (
            <img src={backdrop} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, #181818 100%)' }} />
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
              fontSize: '1rem', backdropFilter: 'blur(4px)',
            }}
          >✕</button>
        </div>

        {/* Info row */}
        <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', marginTop: -60, position: 'relative' }}>
          {/* Poster */}
          <div style={{ flexShrink: 0, width: 130, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', alignSelf: 'flex-start' }}>
            {poster ? (
              <img src={poster} alt={title} style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ width: 130, height: 195, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>📺</div>
            )}
          </div>

          {/* Meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>{title}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              {rating !== undefined && rating > 0 && (
                <span style={{ background: '#f5c518', color: '#000', borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: '0.82rem' }}>
                  ★ {rating.toFixed(1)}
                </span>
              )}
              {year && <span style={{ color: '#aaa', fontSize: '0.82rem' }}>{year}</span>}
              <span style={{ color: '#aaa', fontSize: '0.82rem' }}>{seasons.length} temporada{seasons.length !== 1 ? 's' : ''}</span>
              <span style={{ color: '#aaa', fontSize: '0.82rem' }}>{episodes.length} episódios</span>
              {genres.slice(0, 3).map(g => (
                <span key={g} style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', color: '#ccc' }}>{g}</span>
              ))}
            </div>
            {loading && <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: '0.5rem' }}>Buscando informações...</div>}
            {overview && (
              <p style={{ color: '#ccc', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>{overview}</p>
            )}
          </div>
        </div>

        {/* Seasons + Episodes */}
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>Episódios</h3>
          {seasons.map(({ season, episodes: eps }) => (
            <div key={season} style={{ marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Season header */}
              <button
                onClick={() => setOpenSeason(openSeason === season ? null : season)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1rem', background: openSeason === season ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                  border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                <span>Temporada {season}</span>
                <span style={{ color: '#888', fontSize: '0.82rem' }}>
                  {eps.length} ep  {openSeason === season ? '▲' : '▼'}
                </span>
              </button>

              {/* Episode list */}
              {openSeason === season && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {eps.map((ep, idx) => {
                    const info = parseEpisodeInfo(ep.name);
                    const epLabel = info
                      ? `E${String(info.episode).padStart(2, '0')}${info.label ? ` · ${info.label}` : ''}`
                      : ep.name;
                    return (
                      <div
                        key={idx}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlay(ep.url); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          borderBottom: idx < eps.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          cursor: 'pointer', transition: 'background 0.15s',
                          touchAction: 'manipulation',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#8B5CF6', fontSize: '0.9rem', flexShrink: 0,
                        }}>▶</div>
                        <span style={{ color: '#e5e5e5', fontSize: '0.88rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {epLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
