import axios from 'axios';

const TMDB_TOKEN = process.env.TMDB_TOKEN || '';
const BASE_URL = 'https://api.themoviedb.org/3';

// Simple in-memory cache (title:year:lang → result)
const cache = new Map<string, any>();

export interface TMDBResult {
  title: string;
  overview: string;
  rating: number;
  votes: number;
  year: string;
  genres: string[];
  runtime: number | null;
  poster: string;
  backdrop: string;
  tmdbId: number;
}

function headers() {
  return { Authorization: `Bearer ${TMDB_TOKEN}`, 'Content-Type': 'application/json' };
}

function extractYear(name: string): string | null {
  const match = name.match(/\((\d{4})\)/);
  return match ? match[1] : null;
}

function cleanTitle(name: string): string {
  return name
    .replace(/\(\d{4}\)/g, '')   // remove (year)
    .replace(/\[.*?\]/g, '')      // remove [LEG], [DUB], etc.
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchMovie(rawName: string, language = 'pt-BR'): Promise<TMDBResult | null> {
  const year = extractYear(rawName);
  const title = cleanTitle(rawName);
  const cacheKey = `movie:${title}:${year || ''}:${language}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);

  if (!TMDB_TOKEN) return null;

  try {
    const params: any = { query: title, language, include_adult: false };
    if (year) params.primary_release_year = year;

    const search = await axios.get(`${BASE_URL}/search/movie`, { params, headers: headers(), timeout: 8000 });
    const results = search.data.results;
    if (!results || results.length === 0) {
      cache.set(cacheKey, null);
      return null;
    }

    const movie = results[0];

    // Fetch details for genres and runtime
    let genres: string[] = [];
    let runtime: number | null = null;
    try {
      const detail = await axios.get(`${BASE_URL}/movie/${movie.id}`, {
        params: { language },
        headers: headers(),
        timeout: 5000,
      });
      genres = detail.data.genres?.map((g: any) => g.name) || [];
      runtime = detail.data.runtime || null;
    } catch { /* ignore */ }

    const result: TMDBResult = {
      title: movie.title || rawName,
      overview: movie.overview || '',
      rating: Math.round((movie.vote_average || 0) * 10) / 10,
      votes: movie.vote_count || 0,
      year: movie.release_date?.split('-')[0] || year || '',
      genres,
      runtime,
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '',
      tmdbId: movie.id,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    return null;
  }
}

export async function searchSeries(rawName: string, language = 'pt-BR'): Promise<TMDBResult | null> {
  const year = extractYear(rawName);
  // Clean episode info like "S01 E01"
  const title = cleanTitle(rawName).replace(/S\d+\s*E\d+.*/i, '').trim();
  const cacheKey = `tv:${title}:${year || ''}:${language}`;

  if (cache.has(cacheKey)) return cache.get(cacheKey);
  if (!TMDB_TOKEN) return null;

  try {
    const params: any = { query: title, language, include_adult: false };
    if (year) params.first_air_date_year = year;

    const search = await axios.get(`${BASE_URL}/search/tv`, { params, headers: headers(), timeout: 8000 });
    const results = search.data.results;
    if (!results || results.length === 0) {
      cache.set(cacheKey, null);
      return null;
    }

    const show = results[0];
    const result: TMDBResult = {
      title: show.name || rawName,
      overview: show.overview || '',
      rating: Math.round((show.vote_average || 0) * 10) / 10,
      votes: show.vote_count || 0,
      year: show.first_air_date?.split('-')[0] || year || '',
      genres: [],
      runtime: null,
      poster: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : '',
      backdrop: show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : '',
      tmdbId: show.id,
    };

    cache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
