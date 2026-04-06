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
    g.includes('serie') || g.includes('season') || g.includes('episod') ||
    g.includes('novela') || g.includes('anime') ||
    /s\d{1,2}\s*[xe]\d{1,2}/i.test(n)
  ) return 'series';

  if (
    g.includes('filme') || g.includes('movie') || g.includes('cinema') ||
    g.includes('vod') || g.includes('lancamento') ||
    g.includes('documentario') || g.includes('documentary')
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

// ══════════════════════════════════════════════════════════════════════════════
// REFERENCE-BASED CACHE
// All users share the same IPTV server — content is identical, only the
// username/password in stream URLs differs. We cache content from ONE
// reference account and rewrite URLs for each user on login.
// ══════════════════════════════════════════════════════════════════════════════

interface RefConfig {
  /** Full M3U URL of the reference account */
  url: string;
  /** IPTV server origin, e.g. http://gfbegin.top:8880 */
  origin: string;
  /** Reference account credentials (extracted from URL) */
  username: string;
  password: string;
}

let refConfig: RefConfig | null = null;
let cachedData: PlaylistData | null = null;
let cachedAt = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

/**
 * Extract IPTV server config from a playlist URL.
 * Supports both query-string and Xtream Codes path formats.
 */
function extractConfig(m3uUrl: string): RefConfig | null {
  try {
    const parsed = new URL(m3uUrl);
    const origin = parsed.origin;
    let username = '', password = '';

    // Query string format: ?username=X&password=Y
    if (parsed.searchParams.has('username')) {
      username = parsed.searchParams.get('username') || '';
      password = parsed.searchParams.get('password') || '';
    } else {
      // Xtream path format: /user/pass/...
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        username = parts[0];
        password = parts[1];
      }
    }

    if (!username || !password) return null;
    return { url: m3uUrl, origin, username, password };
  } catch {
    return null;
  }
}

/**
 * Build the M3U URL for a specific user on the same IPTV server.
 */
function buildUserM3uUrl(user: string, pass: string): string {
  if (!refConfig) throw new Error('No reference config');
  const parsed = new URL(refConfig.url);
  parsed.searchParams.set('username', user);
  parsed.searchParams.set('password', pass);
  return parsed.toString();
}

/**
 * Rewrite all stream URLs in cached data to use a specific user's credentials.
 * Replaces /refUser/refPass/ → /user/pass/ in every stream URL.
 */
function rewriteForUser(data: PlaylistData, user: string, pass: string): PlaylistData {
  if (!refConfig) return data;

  const fromPattern = `/${refConfig.username}/${refConfig.password}/`;
  const toPattern = `/${user}/${pass}/`;

  function rewriteItems(items: M3UItem[]): M3UItem[] {
    return items.map(item => ({
      ...item,
      url: item.url.replace(fromPattern, toPattern),
    }));
  }

  return {
    live: rewriteItems(data.live),
    movies: rewriteItems(data.movies),
    series: rewriteItems(data.series),
  };
}

/**
 * Validate user credentials against the IPTV server.
 * Makes a quick HEAD/partial request to see if the M3U URL responds with valid data.
 */
export async function validateCredentials(user: string, pass: string): Promise<boolean> {
  if (!refConfig) return false;

  const url = buildUserM3uUrl(user, pass);
  try {
    // Use stream mode — read only the first chunk then abort.
    // The IPTV server ignores Range headers and sends the full 50MB+ file,
    // so we must use a stream to avoid downloading everything.
    const res = await axios.get(url, {
      timeout: 15000,
      responseType: 'stream',
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      res.data.destroy();
      return false;
    }

    // Read just the first chunk to check for #EXTM3U header
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const done = (val: boolean) => {
        if (!resolved) { resolved = true; res.data.destroy(); resolve(val); }
      };

      res.data.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8', 0, Math.min(chunk.length, 200));
        done(text.includes('#EXTM3U'));
      });

      res.data.on('error', () => done(false));
      res.data.on('end', () => done(false));

      // Safety timeout
      setTimeout(() => done(false), 10000);
    });
  } catch {
    return false;
  }
}

/**
 * Get playlist data for a specific user.
 * Returns cached content with URLs rewritten for the user's credentials.
 */
export function getPlaylistForUser(user: string, pass: string): PlaylistData | null {
  if (!cachedData) return null;
  return rewriteForUser(cachedData, user, pass);
}

/**
 * Legacy: get playlist by URL (used by admin/debug endpoints).
 */
export async function getPlaylist(url: string): Promise<PlaylistData> {
  if (cachedData && refConfig?.url === url && Date.now() - cachedAt < CACHE_TTL) {
    return cachedData;
  }
  const data = await parseM3U(url);
  // If this is the reference URL, update cache
  if (refConfig && refConfig.url === url) {
    cachedData = data;
    cachedAt = Date.now();
  }
  return data;
}

// ── Preload & scheduled refresh ──────────────────────────────────────────────

/**
 * Load the reference playlist from DB and cache it.
 * Called on startup and by the nightly scheduler.
 */
export async function preloadAllPlaylists(): Promise<void> {
  try {
    const playlist = await (prisma as any).playlist.findFirst();
    if (!playlist) {
      console.log('[Preload] No playlist in DB — nothing to cache');
      return;
    }

    const config = extractConfig(playlist.url);
    if (!config) {
      console.log('[Preload] Could not extract config from URL:', playlist.url);
      return;
    }

    refConfig = config;
    console.log(`[Preload] IPTV server: ${config.origin} | ref: ${config.username}`);

    // Force output=m3u8 so ALL content types (movies, series, live) get HLS
    // (.m3u8) stream URLs instead of MP4. This is required for iOS Safari
    // which can play native HLS but struggles with MP4 over a proxy.
    let fetchUrl = config.url;
    try {
      const parsedUrl = new URL(config.url);
      if (parsedUrl.searchParams.has('username')) {
        // Xtream Codes get.php format — set output=m3u8
        parsedUrl.searchParams.set('output', 'm3u8');
        parsedUrl.searchParams.set('type', 'm3u_plus');
        fetchUrl = parsedUrl.toString();
        console.log(`[Preload] Forcing output=m3u8 for HLS compatibility`);
      }
    } catch { /* keep original url if parsing fails */ }

    const start = Date.now();
    cachedData = await parseM3U(fetchUrl);
    cachedAt = Date.now();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    const total = cachedData.live.length + cachedData.movies.length + cachedData.series.length;
    console.log(`[Preload] Cached ${total} items in ${elapsed}s`);
  } catch (err: any) {
    console.error('[Preload] Error:', err.message);
  }
}

/**
 * Schedule automatic refresh at 3:00 AM daily.
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
    preloadAllPlaylists();
    setInterval(preloadAllPlaylists, 24 * 60 * 60 * 1000);
  }, ms);
}
