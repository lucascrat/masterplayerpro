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

function classifyByGroup(group: string): 'live' | 'movie' | 'series' | null {
  const g = normalize(group);

  if (
    g.includes('serie') || g.includes('season') || g.includes('episod') ||
    g.includes('novela') || g.includes('anime') || g.includes('dorama')
  ) return 'series';

  if (
    g.includes('filme') || g.includes('movie') || g.includes('cinema') ||
    g.includes('vod') || g.includes('lancamento') ||
    g.includes('documentario') || g.includes('documentary')
  ) return 'movie';

  if (
    g.includes('canai') || g.includes('24hrs') || g.includes('24h') ||
    g.includes('jogos do dia') || g.includes('radio') || g.includes('adulto')
  ) return 'live';

  return null;
}

function classifyByUrl(url: string): 'live' | 'movie' | 'series' | null {
  // Xtream Codes URL patterns: /movie/user/pass/id, /series/user/pass/id
  if (url.includes('/movie/')) return 'movie';
  if (url.includes('/series/')) return 'series';
  return null;
}

function classifyItem(name: string, group: string, url?: string): 'live' | 'movie' | 'series' {
  // 1. Try URL pattern (most reliable for Xtream Codes)
  if (url) {
    const byUrl = classifyByUrl(url);
    if (byUrl) return byUrl;
  }

  // 2. Try group name
  const byGroup = classifyByGroup(group);
  if (byGroup) return byGroup;

  // 3. Try item name
  const n = normalize(name);
  if (/s\d{1,2}\s*[xe]\d{1,2}/i.test(n)) return 'series';

  return 'live';
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse M3U using streaming to handle very large files (100MB+).
 * Reads the response as a stream and processes line-by-line to avoid
 * loading the entire file into memory at once.
 */
export async function parseM3U(url: string): Promise<PlaylistData> {
  console.log(`[M3U] Fetching: ${url.substring(0, 80)}...`);
  const response = await axios.get(url, {
    timeout: 300000,          // 5 minutes for very large files
    responseType: 'stream',   // Stream instead of loading all to memory
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return new Promise<PlaylistData>((resolve, reject) => {
    const live: M3UItem[] = [];
    const movies: M3UItem[] = [];
    const series: M3UItem[] = [];
    let currentItem: Partial<M3UItem> = {};
    let leftover = '';
    let bytesRead = 0;

    response.data.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      const text = leftover + chunk.toString('utf-8');
      const lines = text.split('\n');
      // Last line might be incomplete — save for next chunk
      leftover = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('#EXTINF:')) {
          const nameMatch = line.match(/,(.*)$/);
          currentItem.name = nameMatch ? nameMatch[1].trim() : 'Unknown';
          const logoMatch = line.match(/tvg-logo="([^"]*)"/);
          currentItem.logo = logoMatch ? logoMatch[1] : '';
          const groupMatch = line.match(/group-title="([^"]*)"/);
          currentItem.group = groupMatch ? groupMatch[1] : 'Default';
        } else if (line.startsWith('http')) {
          currentItem.url = line;
          const type = classifyItem(currentItem.name || '', currentItem.group || '', line);
          currentItem.type = type;
          if (type === 'series') series.push(currentItem as M3UItem);
          else if (type === 'movie') movies.push(currentItem as M3UItem);
          else live.push(currentItem as M3UItem);
          currentItem = {};
        }
      }
    });

    response.data.on('end', () => {
      // Process any remaining data
      if (leftover.trim().startsWith('http') && currentItem.name) {
        currentItem.url = leftover.trim();
        const type = classifyItem(currentItem.name || '', currentItem.group || '', leftover.trim());
        currentItem.type = type;
        if (type === 'series') series.push(currentItem as M3UItem);
        else if (type === 'movie') movies.push(currentItem as M3UItem);
        else live.push(currentItem as M3UItem);
      }

      const mb = (bytesRead / 1024 / 1024).toFixed(1);
      console.log(`[M3U] Parsed ${mb}MB: ${live.length} live | ${movies.length} movies | ${series.length} series`);
      resolve({ live, movies, series });
    });

    response.data.on('error', (err: Error) => {
      reject(new Error(`Stream error: ${err.message}`));
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MULTI-SERVER CACHE
// Each playlist can point to a different IPTV server. We cache content from
// each server separately and try all servers when a user logs in.
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

interface ServerEntry {
  config: RefConfig;
  data: PlaylistData | null;
  cachedAt: number;
  playlistName: string;
}

/** All configured servers, keyed by origin (e.g. "http://one-wave.top") */
const servers = new Map<string, ServerEntry>();
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
 * Build the M3U URL for a specific user on a given IPTV server.
 */
function buildUserM3uUrl(config: RefConfig, user: string, pass: string): string {
  const parsed = new URL(config.url);
  if (parsed.searchParams.has('username')) {
    // get.php / query-string format
    parsed.searchParams.set('username', user);
    parsed.searchParams.set('password', pass);
    return parsed.toString();
  }
  // Path-based format: replace /refUser/refPass/ in URL
  const fromPattern = `/${config.username}/${config.password}/`;
  const toPattern = `/${user}/${pass}/`;
  return config.url.replace(fromPattern, toPattern);
}

/**
 * Rewrite all stream URLs in cached data to use a specific user's credentials.
 * Supports both path-based (/refUser/refPass/) and query-param-based (get.php?username=X) URLs.
 */
function rewriteForUser(config: RefConfig, data: PlaylistData, user: string, pass: string): PlaylistData {
  const fromPathPattern = `/${config.username}/${config.password}/`;
  const toPathPattern = `/${user}/${pass}/`;

  function rewriteUrl(url: string): string {
    // Path-based rewrite: /refUser/refPass/ → /user/pass/
    if (url.includes(fromPathPattern)) {
      return url.replace(fromPathPattern, toPathPattern);
    }
    // Query-param-based rewrite for get.php style stream URLs
    try {
      const parsed = new URL(url);
      if (parsed.searchParams.get('username') === config.username) {
        parsed.searchParams.set('username', user);
        parsed.searchParams.set('password', pass);
        return parsed.toString();
      }
    } catch { /* keep original */ }
    return url;
  }

  function rewriteItems(items: M3UItem[]): M3UItem[] {
    return items.map(item => ({ ...item, url: rewriteUrl(item.url) }));
  }

  return {
    live: rewriteItems(data.live),
    movies: rewriteItems(data.movies),
    series: rewriteItems(data.series),
  };
}

/**
 * Validate user credentials against a specific IPTV server.
 */
async function validateAgainstServer(config: RefConfig, user: string, pass: string): Promise<boolean> {
  const url = buildUserM3uUrl(config, user, pass);
  try {
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
      setTimeout(() => done(false), 10000);
    });
  } catch {
    return false;
  }
}

/**
 * Validate user credentials against ALL configured IPTV servers.
 * Returns the matching server's origin, or null if none matched.
 */
export async function validateCredentials(user: string, pass: string): Promise<string | null> {
  const entries = Array.from(servers.values());
  if (entries.length === 0) return null;

  // Try all servers in parallel for speed
  const results = await Promise.all(
    entries.map(async (entry) => {
      const valid = await validateAgainstServer(entry.config, user, pass);
      return valid ? entry.config.origin : null;
    })
  );

  return results.find(origin => origin !== null) || null;
}

/**
 * Get playlist data for a specific user on a specific server.
 * Returns cached content with URLs rewritten for the user's credentials.
 */
export function getPlaylistForUser(user: string, pass: string, serverOrigin: string): PlaylistData | null {
  const entry = servers.get(serverOrigin);
  if (!entry || !entry.data) return null;
  return rewriteForUser(entry.config, entry.data, user, pass);
}

/**
 * Try to get playlist for user from ANY cached server.
 * Returns { playlist, playlistName, origin } or null.
 */
export function getPlaylistForUserAnyServer(user: string, pass: string): { playlist: PlaylistData; playlistName: string; origin: string } | null {
  for (const [origin, entry] of servers) {
    if (entry.data) {
      return {
        playlist: rewriteForUser(entry.config, entry.data, user, pass),
        playlistName: entry.playlistName,
        origin,
      };
    }
  }
  return null;
}

/**
 * Load playlist on the fly for a server that has no cached data yet.
 * Fetches the M3U, caches it, and returns rewritten data for the user.
 */
export async function loadPlaylistOnDemand(user: string, pass: string, serverOrigin: string): Promise<{ playlist: PlaylistData; playlistName: string } | null> {
  const entry = servers.get(serverOrigin);
  if (!entry) {
    console.error(`[OnDemand] No server entry for origin: ${serverOrigin}`);
    return null;
  }

  // If data is already cached, just rewrite and return
  if (entry.data) {
    return {
      playlist: rewriteForUser(entry.config, entry.data, user, pass),
      playlistName: entry.playlistName,
    };
  }

  // Fetch the M3U using the reference account
  try {
    const fetchUrl = buildFetchUrl(entry.config);
    console.log(`[OnDemand] Loading "${entry.playlistName}" from ${fetchUrl.substring(0, 80)}...`);
    const data = await parseM3U(fetchUrl);

    // Cache it for future requests
    entry.data = data;
    entry.cachedAt = Date.now();

    const total = data.live.length + data.movies.length + data.series.length;
    console.log(`[OnDemand] "${entry.playlistName}" cached ${total} items`);

    return {
      playlist: rewriteForUser(entry.config, data, user, pass),
      playlistName: entry.playlistName,
    };
  } catch (err: any) {
    console.error(`[OnDemand] Failed to load "${entry.playlistName}":`, err.message);

    // Fallback: try loading with the user's own credentials directly
    try {
      const userUrl = buildUserM3uUrl(entry.config, user, pass);
      const userFetchUrl = buildFetchUrl({ ...entry.config, url: userUrl, username: user, password: pass });
      console.log(`[OnDemand] Retrying with user credentials...`);
      const data = await parseM3U(userFetchUrl);

      const total = data.live.length + data.movies.length + data.series.length;
      console.log(`[OnDemand] Loaded ${total} items with user credentials`);

      return {
        playlist: data,
        playlistName: entry.playlistName,
      };
    } catch (err2: any) {
      console.error(`[OnDemand] User credentials fallback also failed:`, err2.message);
      return null;
    }
  }
}

/**
 * Debug: return status of all configured servers.
 */
export function getServersStatus(): any[] {
  const result: any[] = [];
  for (const [origin, entry] of servers) {
    result.push({
      origin,
      playlistName: entry.playlistName,
      refUsername: entry.config.username,
      refUrl: entry.config.url.substring(0, 80) + '...',
      fetchUrl: buildFetchUrl(entry.config).substring(0, 80) + '...',
      hasCachedData: !!entry.data,
      cachedAt: entry.cachedAt ? new Date(entry.cachedAt).toISOString() : null,
      itemCounts: entry.data ? {
        live: entry.data.live.length,
        movies: entry.data.movies.length,
        series: entry.data.series.length,
      } : null,
    });
  }
  return result;
}

/**
 * Debug: test fetching a M3U URL and return first 500 chars + status.
 */
export async function testFetchM3U(url: string): Promise<{ status: number; contentType: string; preview: string; size: number }> {
  const res = await axios.get(url, {
    timeout: 30000,
    responseType: 'text',
    maxContentLength: 100 * 1024 * 1024,
    validateStatus: () => true,
  });
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  return {
    status: res.status,
    contentType: String(res.headers['content-type'] || ''),
    preview: text.substring(0, 500),
    size: text.length,
  };
}

/**
 * Legacy: get playlist by URL (used by admin/debug endpoints).
 */
export async function getPlaylist(url: string): Promise<PlaylistData> {
  // Check if any server cache matches this URL
  for (const entry of servers.values()) {
    if (entry.config.url === url && entry.data && Date.now() - entry.cachedAt < CACHE_TTL) {
      return entry.data;
    }
  }
  return parseM3U(url);
}

// ── Preload & scheduled refresh ──────────────────────────────────────────────

/**
 * Prepare fetch URL: ensure HLS output params are set.
 */
function buildFetchUrl(config: RefConfig): string {
  let fetchUrl = config.url;
  try {
    const parsedUrl = new URL(config.url);
    if (parsedUrl.searchParams.has('username')) {
      if (!parsedUrl.searchParams.has('output')) {
        parsedUrl.searchParams.set('output', 'm3u8');
      }
      if (!parsedUrl.searchParams.has('type')) {
        parsedUrl.searchParams.set('type', 'm3u_plus');
      }
      fetchUrl = parsedUrl.toString();
    }
  } catch { /* keep original */ }
  return fetchUrl;
}

/**
 * Load ALL playlists from DB and cache each one.
 * Called on startup and by the nightly scheduler.
 */
export async function preloadAllPlaylists(): Promise<void> {
  try {
    const playlists = await (prisma as any).playlist.findMany();
    if (!playlists || playlists.length === 0) {
      console.log('[Preload] No playlists in DB — nothing to cache');
      return;
    }

    console.log(`[Preload] Found ${playlists.length} playlist(s) in DB`);

    for (const playlist of playlists) {
      const config = extractConfig(playlist.url);
      if (!config) {
        console.log(`[Preload] Could not extract config from: ${playlist.name}`);
        continue;
      }

      console.log(`[Preload] Loading "${playlist.name}" → ${config.origin} | ref: ${config.username}`);

      const fetchUrl = buildFetchUrl(config);
      const output = new URL(fetchUrl).searchParams.get('output') || 'default';
      console.log(`[Preload] HLS output=${output}`);

      try {
        const start = Date.now();
        const data = await parseM3U(fetchUrl);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const total = data.live.length + data.movies.length + data.series.length;

        servers.set(config.origin, {
          config,
          data,
          cachedAt: Date.now(),
          playlistName: playlist.name,
        });

        console.log(`[Preload] "${playlist.name}" cached ${total} items in ${elapsed}s`);
      } catch (err: any) {
        console.error(`[Preload] Error loading "${playlist.name}":`, err.message);
        // Still register the server config so validation works even without cache
        if (!servers.has(config.origin)) {
          servers.set(config.origin, {
            config,
            data: null,
            cachedAt: 0,
            playlistName: playlist.name,
          });
        }
      }
    }

    const totalServers = servers.size;
    const cachedServers = Array.from(servers.values()).filter(s => s.data !== null).length;
    console.log(`[Preload] Done: ${cachedServers}/${totalServers} servers cached`);
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
