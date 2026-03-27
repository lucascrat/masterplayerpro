import axios from 'axios';
import prisma from '../db';

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function classifyItem(name: string, group: string): 'live' | 'movie' | 'series' {
  const g = normalize(group);
  const n = normalize(name);

  if (
    g.includes('serie') ||
    g.includes('season') ||
    g.includes('episod') ||
    g.includes('novela') ||
    g.includes('anime') ||
    /s\d{1,2}\s*[xe]\d{1,2}/i.test(n)
  ) return 'series';

  if (
    g.includes('filme') ||
    g.includes('movie') ||
    g.includes('cinema') ||
    g.includes('vod') ||
    g.includes('lancamento') ||
    g.includes('documentario') ||
    g.includes('documentary')
  ) return 'movie';

  return 'live';
}

// ── Parser ───────────────────────────────────────────────────────────────────
export async function parseM3U(url: string): Promise<PlaylistData> {
  console.log(`[M3U] Fetching: ${url.substring(0, 60)}...`);
  const response = await axios.get(url, {
    timeout: 120000,
    responseType: 'text',
    maxContentLength: 100 * 1024 * 1024,
  });
  const lines = (response.data as string).split('\n');

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

  console.log(`[M3U] Parsed: ${live.length} live | ${movies.length} movies | ${series.length} series`);
  return { live, movies, series };
}

// ── In-memory cache (24h TTL) ────────────────────────────────────────────────
const m3uCache = new Map<string, { data: PlaylistData; fetchedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get playlist data — returns instantly from cache if available.
 * Only fetches from the M3U URL if cache is expired or missing.
 */
export async function getPlaylist(url: string): Promise<PlaylistData> {
  const cached = m3uCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    const ageMin = Math.round((Date.now() - cached.fetchedAt) / 60000);
    console.log(`[Cache] Hit (age: ${ageMin}min)`);
    return cached.data;
  }

  console.log('[Cache] Miss — fetching M3U...');
  const data = await parseM3U(url);
  m3uCache.set(url, { data, fetchedAt: Date.now() });
  return data;
}

/**
 * Force refresh a specific URL's cache (used by scheduled refresh).
 */
async function refreshUrl(url: string): Promise<void> {
  try {
    const data = await parseM3U(url);
    m3uCache.set(url, { data, fetchedAt: Date.now() });
    console.log(`[Cache] Refreshed: ${url.substring(0, 50)}...`);
  } catch (err: any) {
    console.error(`[Cache] Refresh failed for ${url.substring(0, 50)}: ${err.message}`);
  }
}

// ── Preload & scheduled refresh ──────────────────────────────────────────────

/**
 * Called on server startup: fetch and cache ALL playlists from DB
 * so the first user login is instant.
 */
export async function preloadAllPlaylists(): Promise<void> {
  try {
    const playlists = await (prisma as any).playlist.findMany();
    if (!playlists.length) {
      console.log('[Preload] No playlists in DB — nothing to cache');
      return;
    }

    console.log(`[Preload] Loading ${playlists.length} playlist(s) into cache...`);
    const start = Date.now();

    // Fetch all playlists in parallel (max 3 concurrent)
    const chunks: any[][] = [];
    for (let i = 0; i < playlists.length; i += 3) {
      chunks.push(playlists.slice(i, i + 3));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map((p: any) => refreshUrl(p.url))
      );
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Preload] Done — ${playlists.length} playlist(s) cached in ${elapsed}s`);
  } catch (err: any) {
    console.error('[Preload] Error:', err.message);
  }
}

/**
 * Refresh all cached playlists (called by scheduler).
 */
export async function refreshAllPlaylists(): Promise<void> {
  console.log('[Scheduler] Starting nightly playlist refresh...');
  await preloadAllPlaylists();
  console.log('[Scheduler] Nightly refresh complete');
}

/**
 * Schedule automatic refresh at 3:00 AM local time every day.
 * Call this once on server startup.
 */
export function scheduleNightlyRefresh(): void {
  function msUntilNext3AM(): number {
    const now = new Date();
    const next = new Date();
    next.setHours(3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  const ms = msUntilNext3AM();
  const hours = (ms / 3600000).toFixed(1);
  console.log(`[Scheduler] Next refresh in ${hours}h (3:00 AM)`);

  setTimeout(() => {
    refreshAllPlaylists();
    // After first refresh, repeat every 24h
    setInterval(refreshAllPlaylists, 24 * 60 * 60 * 1000);
  }, ms);
}
