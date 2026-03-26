import axios from 'axios';

interface M3UItem {
  name: string;
  logo: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
}

interface PlaylistData {
  live: M3UItem[];
  movies: M3UItem[];
  series: M3UItem[];
}

// Normalize string: remove accents, lowercase
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function classifyItem(name: string, group: string): 'live' | 'movie' | 'series' {
  const g = normalize(group);
  const n = normalize(name);

  // Series: group name OR S01E01/S01 E01 pattern in item name
  if (
    g.includes('serie') ||    // SERIES, SÉRIES, SERIE
    g.includes('season') ||
    g.includes('episod') ||
    g.includes('novela') ||
    g.includes('anime') ||
    /s\d{1,2}\s*[xe]\d{1,2}/i.test(n)  // S01E01 or S01 E01 in name
  ) {
    return 'series';
  }

  // Movies
  if (
    g.includes('filme') ||    // FILMES
    g.includes('movie') ||
    g.includes('cinema') ||
    g.includes('vod') ||
    g.includes('lancamento') || // LANÇAMENTOS
    g.includes('documentario') ||
    g.includes('documentary')
  ) {
    return 'movie';
  }

  // Default: live
  return 'live';
}

export async function parseM3U(url: string): Promise<PlaylistData> {
  console.log(`[Parser] Fetching M3U from: ${url}`);
  const response = await axios.get(url, { timeout: 30000, responseType: 'text' });
  const content = response.data as string;
  const lines = content.split('\n');

  const live: M3UItem[] = [];
  const movies: M3UItem[] = [];
  const series: M3UItem[] = [];

  let currentItem: Partial<M3UItem> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.*)$/);
      currentItem.name = nameMatch ? nameMatch[1].trim() : 'Unknown';

      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      currentItem.logo = logoMatch ? logoMatch[1] : '';

      const groupMatch = line.match(/group-title="([^"]*)"/);
      currentItem.group = groupMatch ? groupMatch[1] : 'Default';

    } else if (line.startsWith('http')) {
      currentItem.url = line;
      const type = classifyItem(currentItem.name || '', currentItem.group || '');
      currentItem.type = type;

      if (type === 'series') series.push(currentItem as M3UItem);
      else if (type === 'movie') movies.push(currentItem as M3UItem);
      else live.push(currentItem as M3UItem);

      currentItem = {};
    }
  }

  // Stats log
  const seriesGroups = [...new Set(series.map(i => i.group))];
  const movieGroups = [...new Set(movies.map(i => i.group))];
  console.log(`[Parser] Results: ${live.length} live | ${movies.length} movies | ${series.length} series episodes`);
  console.log(`[Parser] Series categories (${seriesGroups.length}):`, seriesGroups);
  console.log(`[Parser] Movie categories (${movieGroups.length}):`, movieGroups);

  return { live, movies, series };
}

const m3uCache = new Map<string, { data: PlaylistData; fetchedAt: number }>();
const M3U_CACHE_TTL = 10 * 60 * 1000;

export async function getPlaylist(url: string): Promise<PlaylistData> {
  const cached = m3uCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < M3U_CACHE_TTL) {
    console.log(`[Cache] Serving cached M3U (age: ${Math.round((Date.now() - cached.fetchedAt) / 1000)}s)`);
    return cached.data;
  }
  const data = await parseM3U(url);
  m3uCache.set(url, { data, fetchedAt: Date.now() });
  return data;
}
