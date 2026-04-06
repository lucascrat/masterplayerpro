import { useEffect, useState } from 'react';
import type { M3UItem } from '../types';

interface TMDBData {
  title: string;
  overview: string;
  rating: number;
  votes: number;
  year: string;
  genres: string[];
  runtime: number | null;
  poster: string;
  backdrop: string;
}

interface MovieDetailProps {
  item: M3UItem;
  onPlay: (url: string) => void;
  onClose: () => void;
}

export default function MovieDetail({ item, onPlay, onClose }: MovieDetailProps) {
  const [tmdb, setTmdb] = useState<TMDBData | null>(null);
  const [loading, setLoading] = useState(true);

  const endpoint = item.type === 'series' ? '/api/tmdb/series' : '/api/tmdb/movie';

  useEffect(() => {
    setLoading(true);
    fetch(`${endpoint}?name=${encodeURIComponent(item.name)}&lang=pt-BR`)
      .then(r => r.json())
      .then(data => { setTmdb(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [item.name, endpoint]);

  const poster = tmdb?.poster || item.logo || '';
  const backdrop = tmdb?.backdrop || '';
  const title = tmdb?.title || item.name;
  const overview = tmdb?.overview || '';
  const rating = tmdb?.rating;
  const year = tmdb?.year || '';
  const genres = tmdb?.genres || [];
  const runtime = tmdb?.runtime;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141414',
          borderRadius: 16,
          overflow: 'hidden',
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Backdrop */}
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', overflow: 'hidden' }}>
          {backdrop && (
            <img src={backdrop} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 40%, #141414 100%)',
          }} />
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

        {/* Content */}
        <div style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem', marginTop: -60, position: 'relative' }}>
          {/* Poster */}
          <div style={{ flexShrink: 0, width: 140, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            {poster ? (
              <img src={poster} alt={title} style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ width: 140, height: 210, background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                {item.type === 'series' ? '📺' : '🎬'}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>{title}</h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              {rating !== undefined && rating > 0 && (
                <span style={{
                  background: '#f5c518', color: '#000',
                  borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: '0.85rem',
                }}>
                  ★ {rating.toFixed(1)}
                </span>
              )}
              {year && <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{year}</span>}
              {runtime && <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{Math.floor(runtime / 60)}h {runtime % 60}min</span>}
              {genres.slice(0, 3).map(g => (
                <span key={g} style={{
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
                  padding: '2px 8px', fontSize: '0.75rem', color: '#ccc',
                }}>{g}</span>
              ))}
            </div>

            {loading && (
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Buscando informações...</div>
            )}

            {overview && (
              <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                {overview}
              </p>
            )}

            {!overview && !loading && (
              <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem', fontStyle: 'italic' }}>
                Sinopse não disponível.
              </p>
            )}

            <button
              onClick={() => onPlay(item.url)}
              style={{
                background: '#8B5CF6', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 28px', fontSize: '1rem',
                fontWeight: 700, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '0.5rem',
                boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
              }}
            >
              ▶ Assistir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
