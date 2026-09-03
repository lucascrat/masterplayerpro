// dotenv/config side-effect import MUST come before any module that reads process.env.DATABASE_URL
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { proxyCandidates, hostInScope } from './lib/upstreamProxy';
import { attachRelayHub, relayGet, hasRelayAgent, relayStatus } from './lib/relayHub';

// Routes
import deviceRoutes from './routes/deviceRoutes';
import adminRoutes from './routes/adminRoutes';
import rewardsRoutes from './routes/rewardsRoutes';
import favoriteRoutes from './routes/favoriteRoutes';
import { searchMovie, searchSeries } from './services/tmdbService';
import { getPlaylist, preloadAllPlaylists, scheduleNightlyRefresh, validateCredentials, getPlaylistForUser, loadPlaylistOnDemand, getServersStatus, testFetchM3U, acquireCredential, renewLease, releaseLease, startLeaseCleanup, findCachedServerByRefCreds } from './services/m3uService';
import prisma from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Startup migrations: ensure all tables/columns exist
(async () => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS username TEXT, ADD COLUMN IF NOT EXISTS password TEXT`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS iptv_credentials (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        "playlistId" TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        "maxLeases" INTEGER DEFAULT 2,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, "playlistId")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS credential_leases (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "appUserId" TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        "credentialId" TEXT NOT NULL REFERENCES iptv_credentials(id) ON DELETE CASCADE,
        "lastActivity" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("appUserId", "credentialId")
      )
    `);
    // Add isWatching and sessionId columns to credential_leases if missing
    await prisma.$executeRawUnsafe(`ALTER TABLE credential_leases ADD COLUMN IF NOT EXISTS "isWatching" BOOLEAN DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE credential_leases ADD COLUMN IF NOT EXISTS "sessionId" TEXT`);
    // Backfill sessionId for any existing rows that don't have one
    await prisma.$executeRawUnsafe(`UPDATE credential_leases SET "sessionId" = gen_random_uuid() WHERE "sessionId" IS NULL`);
    // Add unique index on sessionId
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS credential_leases_sessionId_key ON credential_leases("sessionId")`);
    // Drop old unique constraint if it exists (allow same user+credential on multiple devices)
    await prisma.$executeRawUnsafe(`ALTER TABLE credential_leases DROP CONSTRAINT IF EXISTS "credential_leases_appUserId_credentialId_key"`);
    // Rewards app tables
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS reward_users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "deviceId" TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        coins INTEGER DEFAULT 5,
        "accessUntil" TIMESTAMP(3),
        "appUserId" TEXT UNIQUE REFERENCES app_users(id) ON DELETE SET NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS video_views (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES reward_users(id) ON DELETE CASCADE,
        "adUnitId" TEXT,
        "watchedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS video_views_user_watched_idx ON video_views("userId", "watchedAt")`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ad_nonces (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL REFERENCES reward_users(id) ON DELETE CASCADE,
        nonce TEXT UNIQUE NOT NULL,
        "adUnitId" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "redeemedAt" TIMESTAMP(3)
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ad_nonces_user_created_idx ON ad_nonces("userId", "createdAt")`);
    // Backfill accessUntil for legacy reward users created before timer-on-earn:
    // each coin represents 2h of access counted from now.
    await prisma.$executeRawUnsafe(`
      UPDATE reward_users
      SET "accessUntil" = NOW() + (coins * INTERVAL '2 hours')
      WHERE "accessUntil" IS NULL AND coins > 0
    `);

    // Backfill: Normalize all app_users usernames to lowercase
    await prisma.$executeRawUnsafe(`UPDATE app_users SET username = LOWER(TRIM(username))`);
    
    console.log('[DB] All tables ready');
  } catch (e: any) {
    console.log('[DB] Migration note:', e.message);
  }
})();

// Ensure a default AdminUser exists (required for playlist FK)
(async () => {
  try {
    const existing = await prisma.adminUser.findFirst();
    if (!existing) {
      await prisma.adminUser.create({
        data: { email: 'admin@masterplayer.local', password: 'master2024', name: 'Admin' }
      });
      console.log('[DB] Default admin user created');
    }
  } catch (e: any) {
    console.log('[DB] Admin seed note:', e.message);
  }
})();

// API Routes
app.use('/api', deviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/favorites', favoriteRoutes);

// ── Stream Proxy ─────────────────────────────────────────────────────────────
// IPTV servers run on HTTP, app is on HTTPS — browser blocks mixed content.
// This proxy fetches the stream server-side (no mixed content) and pipes
// it back to the client over our HTTPS connection.
// For HLS manifests (.m3u8) it rewrites internal URLs to also go through proxy.

/** Rewrite every segment / sub-playlist URL in an HLS manifest through /api/proxy.
 *  When `viaRelay` the child requests are tagged `&relay=1` so segments (which
 *  the provider also serves from datacenter-blocked CDN hosts) go through the
 *  residential agent too. */
function rewriteManifest(text: string, finalUrl: string, viaRelay = false): string {
  const finalParsed = new URL(finalUrl);
  const finalOrigin = finalParsed.origin;
  const finalDir    = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
  const tag = viaRelay ? '&relay=1' : '';
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      return line.replace(/URI=["']([^"']+)["']/g, (_m, p1) => {
        let abs = p1;
        if (!p1.startsWith('http')) abs = p1.startsWith('/') ? finalOrigin + p1 : finalDir + p1;
        return `URI="/api/proxy?url=${encodeURIComponent(abs)}${tag}"`;
      });
    }
    let fullUrl: string;
    if (trimmed.startsWith('http')) fullUrl = trimmed;
    else if (trimmed.startsWith('/')) fullUrl = finalOrigin + trimmed;
    else fullUrl = finalDir + trimmed;
    return `/api/proxy?url=${encodeURIComponent(fullUrl)}${tag}`;
  }).join('\n');
}

const isManifestUrl = (u: string) => u.split('?')[0].toLowerCase().endsWith('.m3u8');

// Tiny per-URL cache of relayed manifests. Live playlists change every few
// seconds; a 2s hit rate collapses rapid re-polls, and a slightly stale copy
// (<6s) is a good bridge across a relay reconnect blip.
const manifestCache = new Map<string, { body: string; at: number }>();
const MANIFEST_FRESH_MS = 2_000;
const MANIFEST_STALE_MS = 6_000;

app.get('/api/proxy', async (req, res) => {
  const targetUrl = String(req.query['url'] || '');

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.status(400).send('Missing or invalid url parameter');
    return;
  }

  // console.log(`[Proxy] Request: ${targetUrl}`);

  // ── Relay path ────────────────────────────────────────────────────────────
  // Route through the residential agent (dodges the datacenter 403) when it's
  // connected AND either: this is a manifest for a scoped host, or the request
  // was tagged &relay=1 by a manifest we already fetched via the relay (its
  // segments live on CDN hosts that also block the datacenter).
  const forceRelay = req.query['relay'] === '1';
  const manifestReq = isManifestUrl(targetUrl);
  const relayEligible = hasRelayAgent() &&
    (forceRelay || (manifestReq && hostInScope(targetUrl)));
  if (relayEligible) {
    // Serve a very-fresh cached manifest without bothering the agent.
    if (manifestReq) {
      const c = manifestCache.get(targetUrl);
      if (c && Date.now() - c.at < MANIFEST_FRESH_MS) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(c.body);
        return;
      }
    }
    try {
      const r = await relayGet(targetUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      if (r.status >= 200 && r.status < 400 && r.body.length) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const ct = String(r.headers['content-type'] || '').toLowerCase();
        const asManifest = manifestReq || ct.includes('mpegurl');
        if (asManifest) {
          const finalUrl = r.headers['x-final-url'] || targetUrl;
          const body = rewriteManifest(r.body.toString('utf-8'), finalUrl, true);
          manifestCache.set(targetUrl, { body, at: Date.now() });
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.send(body);
        } else {
          res.setHeader('Content-Type', r.headers['content-type'] || 'video/mp2t');
          res.send(r.body);
        }
        return;
      }
      console.warn(`[Proxy] relay returned ${r.status} for ${targetUrl.split('?')[0]}, falling back`);
    } catch (e: any) {
      console.warn(`[Proxy] relay failed (${e.message}), falling back to direct/proxy`);
    }
    // Relay hiccup: a slightly stale manifest keeps playback alive.
    if (manifestReq) {
      const c = manifestCache.get(targetUrl);
      if (c && Date.now() - c.at < MANIFEST_STALE_MS) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(c.body);
        return;
      }
    }
  }

  try {
    const rangeHeader = req.headers['range'];
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
    };
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    // Try each configured proxy in turn, then direct (proxyCandidates always
    // ends with `false`). IPTV providers 403 datacenter IPs and rate-limit,
    // so on a retriable failure move to the next candidate; a couple of quick
    // retries per candidate smooth over transient blips. Range/seek requests
    // aren't retried (they must hit the same connection quickly).
    const candidates = proxyCandidates(targetUrl);
    const triesPer = rangeHeader ? 1 : 2;
    let upstream: AxiosResponse | undefined;
    let lastErr: any;
    for (const proxy of candidates) {
      let advance = false;
      for (let attempt = 1; attempt <= triesPer && !upstream; attempt++) {
        try {
          upstream = await axios.get(targetUrl, {
            responseType: 'stream',
            timeout: 20000,
            maxRedirects: 10,
            headers: upstreamHeaders,
            proxy,
            validateStatus: (status) => status >= 200 && status < 400,
          });
        } catch (e: any) {
          lastErr = e;
          const code = e?.response?.status;
          const retriable = code === 403 || code === 429 || (code >= 500 && code < 600) ||
            e?.code === 'ECONNRESET' || e?.code === 'ECONNABORTED' ||
            e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT';
          if (!retriable) { advance = false; break; }   // real error — stop
          advance = true;
          if (attempt < triesPer) await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
      if (upstream) break;
      if (!advance) break;   // non-retriable — don't bother with other proxies
    }
    if (!upstream) throw lastErr;

    const contentType = String(upstream.headers['content-type'] || '').toLowerCase();
    const isM3U8 = contentType.includes('mpegurl') ||
                   contentType.includes('x-mpegurl') ||
                   targetUrl.split('?')[0].endsWith('.m3u8');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Accept-Ranges', 'bytes');

    if (isM3U8) {
      let text = '';
      upstream.data.on('data', (chunk: Buffer) => { text += chunk.toString(); });
      upstream.data.on('end', () => {
        if (!text.trim()) {
          res.status(502).send('Upstream returned empty manifest');
          return;
        }
        const finalUrl: string = (upstream!.request as any)?.res?.responseUrl || targetUrl;
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewriteManifest(text, finalUrl));
      });
    } else {
      res.setHeader('Content-Type', contentType || 'video/mp2t');
      if (upstream.headers['content-length']) res.setHeader('Content-Length', upstream.headers['content-length'] as string);
      if (upstream.headers['content-range']) res.setHeader('Content-Range', upstream.headers['content-range'] as string);

      const statusCode = upstream.status === 206 ? 206 : 200;
      res.status(statusCode);
      req.on('close', () => upstream.data.destroy());
      upstream.data.pipe(res);
    }
  } catch (err: any) {
    console.error(`[Proxy Error] ${targetUrl} -> ${err.message}`);
    if (!res.headersSent) {
      // Return a 502 with the message so the client can show it
      res.status(502).setHeader('Content-Type', 'text/plain');
      res.send(`Erro no servidor de stream: ${err.message}`);
    }
  }
});

// ── M3U text proxy ───────────────────────────────────────────────────────────
// Fetches a playlist M3U server-side and returns the RAW text untouched (no URL
// rewriting, unlike /api/proxy). The client uses this as its first, most
// reliable option to load the playlist — no CORS, no flaky third-party proxies.
app.get('/api/m3u', async (req, res) => {
  const targetUrl = String(req.query['url'] || '');
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    res.status(400).send('Missing or invalid url parameter');
    return;
  }

  try {
    let upstream: AxiosResponse | undefined;
    let lastErr: any;
    for (const proxy of proxyCandidates(targetUrl)) {
      try {
        upstream = await axios.get(targetUrl, {
          responseType: 'text',
          timeout: 45000,
          maxRedirects: 10,
          maxContentLength: 80 * 1024 * 1024, // 80 MB cap
          maxBodyLength: 80 * 1024 * 1024,
          transformResponse: (d) => d, // keep as string
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
          },
          proxy,
          validateStatus: (s) => s >= 200 && s < 400,
        });
        break;
      } catch (e: any) { lastErr = e; }
    }
    if (!upstream) throw lastErr;

    const body = typeof upstream.data === 'string' ? upstream.data : String(upstream.data ?? '');
    if (!body.trim()) {
      res.status(502).send('Upstream returned an empty playlist');
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(body);
  } catch (err: any) {
    console.error(`[M3U Proxy Error] ${targetUrl.split('?')[0]} -> ${err.message}`);
    if (!res.headersSent) {
      res.status(502).setHeader('Content-Type', 'text/plain');
      res.send(`Falha ao baixar a lista: ${err.message}`);
    }
  }
});

// TMDB API proxy (token stays on server)
app.get('/api/tmdb/movie', async (req, res) => {
  const name = String(req.query['name'] || '');
  const lang = String(req.query['lang'] || 'pt-BR');
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const result = await searchMovie(name, lang);
  res.json(result);
});

app.get('/api/tmdb/series', async (req, res) => {
  const name = String(req.query['name'] || '');
  const lang = String(req.query['lang'] || 'pt-BR');
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const result = await searchSeries(name, lang);
  res.json(result);
});

// Batch poster fetch — accepts { items: [{name, type}] }, returns { [name]: posterUrl }
app.post('/api/tmdb/posters', async (req, res) => {
  const items: { name: string; type: string }[] = req.body?.items || [];
  if (!items.length) { res.json({}); return; }

  // Process in parallel, limit to 10 concurrent
  const results: Record<string, string> = {};
  const chunks: typeof items[] = [];
  for (let i = 0; i < items.length; i += 10) chunks.push(items.slice(i, i + 10));

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async ({ name, type }) => {
      try {
        const data = type === 'series'
          ? await searchSeries(name, 'pt-BR')
          : await searchMovie(name, 'pt-BR', true); // skip details for speed
        if (data?.poster) results[name] = data.poster;
      } catch { /* ignore */ }
    }));
  }

  res.json(results);
});

// Client login — authenticates AppUser, acquires IPTV credential from pool,
// and returns playlist with URLs rewritten for the assigned credential.
// Falls back to direct IPTV validation for backwards compatibility.
app.post('/api/auth/login', async (req, res) => {
  const { username: rawUsername, password, sessionId: clientSessionId } = req.body;
  if (!rawUsername || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    return;
  }
  const username = rawUsername.trim().toLowerCase();
  try {
    // 1. Try AppUser authentication (new pool system)
    const appUser = await prisma.appUser.findUnique({ where: { username } });
    if (appUser) {
      if (!appUser.isActive) {
        res.status(403).json({ error: 'Conta desativada. Contate o administrador.' });
        return;
      }
      if (appUser.password !== password) {
        res.status(401).json({ error: 'Usuário ou senha incorretos' });
        return;
      }

      // Acquire a credential from the pool (reuses session if clientSessionId provided)
      let result;
      try {
        result = await acquireCredential(appUser.id, clientSessionId);
      } catch (err: any) {
        if (err.message?.startsWith('SCREEN_LIMIT:')) {
          res.status(403).json({ error: err.message.replace('SCREEN_LIMIT:', '') });
          return;
        }
        throw err;
      }
      if (!result) {
        res.status(503).json({ error: 'Nenhuma credencial disponível no momento. Tente novamente em alguns minutos.' });
        return;
      }

      res.json({
        success: true,
        playlistName: result.playlistName,
        playlist: result.playlist,
        userId: appUser.id,
        sessionId: result.sessionId,
      });
      return;
    }

    // 2. Fallback: direct IPTV server validation (legacy/backwards compat)
    let matchedOrigin = await validateCredentials(username, password);

    // 2b. Resilience: if the live check failed but these are EXACTLY the ref
    // credentials of a configured server we already hold a cached playlist
    // for, the provider is just unreachable from us right now (it throttles
    // our IP). Don't lock the user out — serve the cache.
    if (!matchedOrigin) {
      const cachedOrigin = findCachedServerByRefCreds(username, password);
      if (cachedOrigin) {
        console.warn(`[Login] Live validation failed for ${username}; serving cached playlist (provider unreachable).`);
        matchedOrigin = cachedOrigin;
      }
    }

    if (!matchedOrigin) {
      res.status(401).json({ error: 'Usuário ou senha incorretos' });
      return;
    }

    const cached = getPlaylistForUser(username, password, matchedOrigin);
    if (cached) {
      res.json({ success: true, playlistName: 'Krator+', playlist: cached });
      return;
    }

    try {
      const onDemand = await loadPlaylistOnDemand(username, password, matchedOrigin);
      if (onDemand) {
        res.json({ success: true, playlistName: onDemand.playlistName, playlist: onDemand.playlist });
        return;
      }
    } catch (loadErr: any) {
      console.error('[Login] On-demand load failed:', loadErr.message);
    }

    res.status(503).json({ error: 'Servidor carregando conteúdo. Tente novamente em 30 segundos.' });
  } catch (err: any) {
    console.error('[Login] Error:', err.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Code login — user typed a KRT-XXXXXX code from the rewards app.
// Consumes 1 coin if accessUntil is in the past, else renews the live session.
// Creates/links a synthetic AppUser behind the scenes so the existing credential
// pool + lease system keeps working unchanged.
app.post('/api/auth/redeem-code', async (req, res) => {
  const { code, sessionId: clientSessionId } = req.body || {};
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Código obrigatório' });
    return;
  }
  const normalized = code.trim().toUpperCase();
  try {
    const user = await prisma.rewardUser.findUnique({ where: { code: normalized } });
    if (!user) {
      res.status(404).json({ error: 'Código inválido' });
      return;
    }

    const now = new Date();
    const accessUntil = user.accessUntil;

    // Hours start counting the moment coins are earned (in the rewards app).
    // Here we just verify the timer is still running.
    if (!accessUntil || accessUntil <= now) {
      res.status(402).json({ error: 'Sem tempo de acesso. Assista vídeos no app Krator Rewards para ganhar horas.' });
      return;
    }

    // Ensure synthetic AppUser exists for this reward user
    let appUserId = user.appUserId;
    if (!appUserId) {
      const synthUsername = `reward_${user.code.replace('-', '_').toLowerCase()}`;
      const synthPassword = crypto.randomBytes(16).toString('hex');
      const appUser = await prisma.appUser.upsert({
        where: { username: synthUsername },
        create: { username: synthUsername, password: synthPassword, name: `Rewards ${user.code}` },
        update: {},
      });
      appUserId = appUser.id;
      await prisma.rewardUser.update({
        where: { id: user.id },
        data: { appUserId },
      });
    }

    let result;
    try {
      result = await acquireCredential(appUserId, clientSessionId);
    } catch (err: any) {
      if (err.message?.startsWith('SCREEN_LIMIT:')) {
        res.status(403).json({ error: err.message.replace('SCREEN_LIMIT:', '') });
        return;
      }
      throw err;
    }
    if (!result) {
      res.status(503).json({ error: 'Sem credenciais disponíveis. Tente em alguns minutos.' });
      return;
    }

    res.json({
      success: true,
      playlistName: result.playlistName,
      playlist: result.playlist,
      userId: appUserId,
      sessionId: result.sessionId,
      code: user.code,
      coins: user.coins,
      accessUntil: accessUntil.toISOString(),
    });
  } catch (err: any) {
    console.error('[Redeem] Error:', err.message);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Heartbeat — keeps the credential lease alive for this specific device session
// isWatching: true = player open (5min timeout), false = idle (2min timeout)
app.post('/api/auth/heartbeat', async (req, res) => {
  const { sessionId, isWatching } = req.body;
  if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
  try {
    const renewed = await renewLease(sessionId, !!isWatching);
    res.json({ success: renewed });
  } catch {
    res.json({ success: false });
  }
});

// Logout — releases this device's session back to the pool
app.post('/api/auth/logout', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
  try {
    await releaseLease(sessionId);
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

// Debug: show status of all configured IPTV servers
app.get('/api/debug/servers', (_req, res) => {
  res.json(getServersStatus());
});

// Debug: is the residential relay agent connected?
app.get('/api/debug/relay', (_req, res) => {
  res.json(relayStatus());
});

// Debug: test fetch a specific playlist URL
app.get('/api/debug/test-fetch', async (req, res) => {
  const url = String(req.query['url'] || '');
  if (!url) { res.status(400).json({ error: 'url param required' }); return; }
  try {
    const result = await testFetchM3U(url);
    res.json(result);
  } catch (err: any) {
    res.json({ error: err.message, code: err.code });
  }
});

// Debug: force reload all playlists
app.post('/api/debug/reload', async (_req, res) => {
  try {
    await preloadAllPlaylists();
    res.json({ success: true, servers: getServersStatus() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Playlist analysis endpoint — returns stats about series/movies/live counts and categories
app.get('/api/debug/playlist', async (_req, res) => {
  try {
    const playlist = await prisma.playlist.findFirst();
    if (!playlist) { res.json({ error: 'No playlist found' }); return; }

    const data = await getPlaylist(playlist.url);

    // Count unique show names in series (strip S01E01)
    const showNames = new Set(
      data.series.map(i => i.name.replace(/\s*[-–—]?\s*S\d{1,2}\s*[xXeE]\d{1,2}.*/i, '').trim())
    );

    const seriesGroups: Record<string, number> = {};
    const movieGroups: Record<string, number> = {};
    for (const i of data.series) seriesGroups[i.group] = (seriesGroups[i.group] || 0) + 1;
    for (const i of data.movies) movieGroups[i.group] = (movieGroups[i.group] || 0) + 1;

    res.json({
      totals: {
        live: data.live.length,
        movies: data.movies.length,
        seriesEpisodes: data.series.length,
        uniqueShows: showNames.size,
      },
      seriesCategories: seriesGroups,
      movieCategories: movieGroups,
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err.message) });
  }
});

// Serve static files from the React app build
const buildPath = path.join(__dirname, '../dist');
app.use(express.static(buildPath));

// For the Admin panel (if accessed directly)
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// All other requests serve the React app (Express v5 wildcard syntax)
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const httpServer = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Krator+ Server running on port ${PORT} (0.0.0.0)`);

  // Preload all playlists into memory so first login is instant
  preloadAllPlaylists();

  // Schedule automatic M3U refresh at 3:00 AM daily
  scheduleNightlyRefresh();

  // Start credential lease cleanup (every 60s, removes leases inactive > 5min)
  startLeaseCleanup();
});

// Reverse relay hub — a residential agent can dial in over WebSocket to fetch
// blocked manifest URLs on the server's behalf.
attachRelayHub(httpServer);
