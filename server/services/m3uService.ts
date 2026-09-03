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
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Map raw M3U group-title strings to clean, human-readable display names.
 * Unknown groups fall back to a generic prefix-stripping rule.
 */
const GROUP_NAME_MAP: Record<string, string> = {
  // VOD - Movies
  '(vod br) filmes':                    'Filmes BR',
  '(vod mult leg) filmes':              'Legendados',
  '(vod br) cinema cam':                'Cinema CAM',
  '(vod es) peliculas y series es':     'Espanhol',
  '(vod) novelas br':                   'Novelas',
  '(vod) lgbt':                         'LGBT',
  '(vod) xxx +18':                      'Adulto',
  // VOD - Series
  '(vod br) séries':                    'Séries BR',
  '(vod br) series':                    'Séries BR',
  // Live - Brazil
  'canais | brasil':                    'Brasil',
  'canais br 4k':                       'Brasil 4K',
  'canais | brasil 24h':                'Brasil 24h',
  'canais | nba league pass':           'NBA',
  'canais | portugal (pt)':             'Portugal',
  'canais | xxx +18':                   'Adulto',
  // Live - Spanish
  'canales | deportes':                 'Esportes',
  'canales | deportes ppv':             'Esportes PPV',
  'canales | nba':                      'NBA ES',
  'canales | documentales':             'Documentários',
  'canales | infantiles':               'Infantil',
  'canales | variedades':               'Variedades',
  'canales | notícias':                 'Notícias',
  'canales | noticias':                 'Notícias',
  'canales | peliculas y series':       'Filmes ES',
  'canales | 24h':                      '24h ES',
  'canales | entretenimento y novelas': 'Entretenimento',
  // Live - International
  'canal | france':                     'França',
  'channels | usa':                     'USA',
  // Live - Local TV
  'tv local (ar)':                      'Argentina',
  'tv local (bo)':                      'Bolívia',
  'tv local (cl)':                      'Chile',
  'tv local (co)':                      'Colômbia',
  'tv local (cu)':                      'Cuba',
  'tv local (es)':                      'Espanha',
  'tv local (mex)':                     'México',
  'tv local (pe)':                      'Peru',
  'tv local (py)':                      'Paraguai',
  'tv local (rd)':                      'R. Dominicana',
  'tv local (uy)':                      'Uruguai',
  'tv local (ve)':                      'Venezuela',
  // Misc
  'rádio br':                           'Rádio',
  'radio br':                           'Rádio',
  'câmeras | play store':               'Câmeras',
  'cameras | play store':               'Câmeras',
  'variados':                           'Variados',
};

export function normalizeGroupName(raw: string): string {
  if (!raw) return raw;
  const mapped = GROUP_NAME_MAP[raw.toLowerCase().trim()];
  if (mapped) return mapped;
  // Generic prefix stripping for unknown groups
  return raw
    .replace(/^\(VOD\s+[^)]+\)\s*/i, '')
    .replace(/^Canai[s]?\s*[|]\s*/i, '')
    .replace(/^Canale[s]?\s*[|]\s*/i, '')
    .replace(/^Channel[s]?\s*[|]\s*/i, '')
    .replace(/^Canal\s*[|]\s*/i, '')
    .trim() || raw;
}

function classifyByGroup(group: string): 'live' | 'movie' | 'series' | null {
  const g = normalize(group);

  // 'novela' removed from series — novela URLs contain /movie/ so
  // URL-based detection correctly classifies them before this fallback runs.
  if (
    g.includes('serie') || g.includes('season') || g.includes('episod') ||
    g.includes('anime') || g.includes('dorama')
  ) return 'series';

  if (
    g.includes('filme') || g.includes('movie') || g.includes('cinema') ||
    g.includes('vod') || g.includes('lancamento') || g.includes('novela') ||
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
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
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
          // Normalize immediately so the rest of the app sees clean names
          currentItem.group = normalizeGroupName(groupMatch ? groupMatch[1] : 'Default');
        } else if (line.startsWith('http')) {
          currentItem.url = line;
          // Classify using the RAW group-title (before normalization) for best accuracy,
          // but URL-based detection runs first anyway so this only matters as fallback.
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
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

      let buffer = '';
      res.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        // Check if we have enough data to identify an M3U file
        if (buffer.length >= 7) {
          done(buffer.trim().startsWith('#EXTM3U'));
        }
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
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
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
 * Prepare fetch URL: ALWAYS force HLS output for browser playback.
 * Browsers can't play raw MPEG-TS — they need HLS (.m3u8) manifests.
 * Regardless of what the admin sets (output=mpegts, output=hls, etc.),
 * we always force output=m3u8 so stream URLs end in .m3u8 and HLS.js works.
 */
function buildFetchUrl(config: RefConfig): string {
  let fetchUrl = config.url;
  try {
    const parsedUrl = new URL(config.url);
    if (parsedUrl.searchParams.has('username')) {
      // Respect original output format if provided (some servers 404 on m3u8)
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

// ══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL LEASE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

const LEASE_TIMEOUT_WATCHING_MS = 5 * 60 * 1000; // 5 minutes if watching
const LEASE_TIMEOUT_IDLE_MS = 2 * 60 * 1000;     // 2 minutes if idle (not watching)
const MAX_SCREENS_PER_USER = 2;                   // max simultaneous device sessions

/**
 * Acquire an IPTV credential for an app user.
 * Each login creates a new session (device). Max 2 screens per user.
 * If existingSessionId is provided, reuses that session (page refresh / app reopen).
 */
export async function acquireCredential(appUserId: string, existingSessionId?: string): Promise<{ playlist: PlaylistData; playlistName: string; credentialId: string; sessionId: string } | null> {
  // Clean expired leases first
  await cleanupExpiredLeases();

  // If client sends an existing sessionId, try to reuse that session
  if (existingSessionId) {
    const existing = await prisma.credentialLease.findUnique({
      where: { sessionId: existingSessionId },
      include: { credential: { include: { playlist: true } } },
    });
    if (existing && existing.appUserId === appUserId) {
      // Renew the existing session
      await prisma.credentialLease.update({
        where: { id: existing.id },
        data: { lastActivity: new Date() },
      });
      const cred = existing.credential;
      let entry: ServerEntry | undefined;
      try { entry = servers.get(new URL(cred.playlist.url).origin); } catch {}
      if (entry?.data) {
        return {
          playlist: rewriteForUser(entry.config, entry.data, cred.username, cred.password),
          playlistName: cred.playlist.name,
          credentialId: cred.id,
          sessionId: existing.sessionId,
        };
      }
    }
    // Session not found or expired — fall through to create new one
  }

  // Check how many active sessions this user has
  const activeSessions = await prisma.credentialLease.count({ where: { appUserId } });
  if (activeSessions >= MAX_SCREENS_PER_USER) {
    throw new Error(`SCREEN_LIMIT:Limite de ${MAX_SCREENS_PER_USER} telas atingido. Saia de outro dispositivo primeiro.`);
  }

  // Get all active credentials with their lease counts
  const credentials = await prisma.iptvCredential.findMany({
    where: { isActive: true },
    include: {
      playlist: true,
      leases: true,
    },
  });

  // Find one with available slots
  for (const cred of credentials) {
    if (cred.leases.length < cred.maxLeases) {
      // Create lease with unique sessionId for this device
      const lease = await prisma.credentialLease.create({
        data: { appUserId, credentialId: cred.id },
      });

      // Find the server entry for this playlist
      let entry: ServerEntry | undefined;
      try {
        const origin = new URL(cred.playlist.url).origin;
        entry = servers.get(origin);
      } catch {}

      if (entry?.data) {
        return {
          playlist: rewriteForUser(entry.config, entry.data, cred.username, cred.password),
          playlistName: cred.playlist.name,
          credentialId: cred.id,
          sessionId: lease.sessionId,
        };
      }

      // Cache not ready — try on-demand load
      try {
        const origin = new URL(cred.playlist.url).origin;
        const result = await loadPlaylistOnDemand(cred.username, cred.password, origin);
        if (result) {
          return { ...result, credentialId: cred.id, sessionId: lease.sessionId };
        }
      } catch {}

      // Clean up lease if we couldn't get the playlist
      await prisma.credentialLease.delete({ where: { id: lease.id } });
    }
  }

  return null; // No credentials available
}

/**
 * Renew a specific session's lease (heartbeat).
 * Uses sessionId to target the exact device, not all user leases.
 */
export async function renewLease(sessionId: string, isWatching: boolean = false): Promise<boolean> {
  const result = await prisma.credentialLease.updateMany({
    where: { sessionId },
    data: { lastActivity: new Date(), isWatching },
  });
  return result.count > 0;
}

/**
 * Release a specific session (explicit logout from one device).
 */
export async function releaseLease(sessionId: string): Promise<void> {
  await prisma.credentialLease.deleteMany({ where: { sessionId } });
}

/**
 * Clean up expired leases using smart timeouts:
 * - Watching (player open): expires after 5 minutes of no heartbeat
 * - Idle (no player): expires after 2 minutes of no heartbeat
 * This releases credentials much faster when users aren't actively watching.
 */
export async function cleanupExpiredLeases(): Promise<number> {
  const now = Date.now();
  const watchingCutoff = new Date(now - LEASE_TIMEOUT_WATCHING_MS);
  const idleCutoff = new Date(now - LEASE_TIMEOUT_IDLE_MS);

  // Delete idle leases (not watching) older than 2 min
  const idleResult = await prisma.credentialLease.deleteMany({
    where: { isWatching: false, lastActivity: { lt: idleCutoff } },
  });

  // Delete watching leases older than 5 min (stale — user probably closed browser)
  const watchResult = await prisma.credentialLease.deleteMany({
    where: { isWatching: true, lastActivity: { lt: watchingCutoff } },
  });

  const total = idleResult.count + watchResult.count;
  if (total > 0) {
    console.log(`[Leases] Cleaned up ${total} expired lease(s) (${idleResult.count} idle, ${watchResult.count} stale-watching)`);
  }
  return total;
}

/**
 * Start periodic lease cleanup (every 60 seconds).
 */
export function startLeaseCleanup(): void {
  setInterval(cleanupExpiredLeases, 60 * 1000);
  console.log('[Leases] Cleanup scheduler started (every 60s)');
}
