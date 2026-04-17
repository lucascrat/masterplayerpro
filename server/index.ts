import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

// Routes
import deviceRoutes from './routes/deviceRoutes';
import adminRoutes from './routes/adminRoutes';
import { searchMovie, searchSeries } from './services/tmdbService';
import { getPlaylist, preloadAllPlaylists, scheduleNightlyRefresh, validateCredentials, getPlaylistForUser, getPlaylistForUserAnyServer, loadPlaylistOnDemand, getServersStatus, testFetchM3U, acquireCredential, renewLease, releaseLease, startLeaseCleanup } from './services/m3uService';
import prisma from './db';

dotenv.config();

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

// ── Stream Proxy ─────────────────────────────────────────────────────────────
// IPTV servers run on HTTP, app is on HTTPS — browser blocks mixed content.
// This proxy fetches the stream server-side (no mixed content) and pipes
// it back to the client over our HTTPS connection.
// For HLS manifests (.m3u8) it rewrites internal URLs to also go through proxy.
app.get('/api/proxy', async (req, res) => {
  const targetUrl = String(req.query['url'] || '');

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.status(400).send('Missing or invalid url parameter');
    return;
  }

  try {
    // Forward Range header from client — required for iOS Safari MP4 playback.
    // iOS Safari always sends "Range: bytes=0-1" as a preflight before playing;
    // without forwarding it the IPTV server ignores seek/resume and iOS refuses to play.
    const rangeHeader = req.headers['range'];
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; IPTV)',
      'Accept': '*/*',
    };
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    const upstream = await axios.get(targetUrl, {
      responseType: 'stream',
      timeout: 0,           // no timeout — live streams run indefinitely
      maxRedirects: 5,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: upstreamHeaders,
      // Don't throw on 206 Partial Content or other 2xx codes
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const contentType = String(upstream.headers['content-type'] || '');
    const isM3U8 = contentType.includes('mpegurl') ||
                   contentType.includes('x-mpegURL') ||
                   targetUrl.split('?')[0].endsWith('.m3u8');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    // Tell clients (especially iOS Safari) that we accept range requests
    res.setHeader('Accept-Ranges', 'bytes');

    if (isM3U8) {
      // Collect manifest text, rewrite segment/chunk URLs to go through proxy
      let text = '';
      upstream.data.on('data', (chunk: Buffer) => { text += chunk.toString(); });
      upstream.data.on('end', () => {
        // Use the FINAL url after redirects (axios follows 302s internally).
        // The server redirects gfbegin.top → 208.122.18.50 with a token, so
        // segment paths like /hls/hash/seg.ts belong to the redirect target,
        // not the original host.
        const finalUrl: string = (upstream.request as any)?.res?.responseUrl || targetUrl;
        const finalParsed  = new URL(finalUrl);
        const finalOrigin  = finalParsed.origin;                                        // http://208.122.18.50:8880
        const finalDir     = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);     // http://208.122.18.50:8880/live/.../

        const rewritten = text.split('\n').map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;

          let fullUrl: string;
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            fullUrl = trimmed;                  // already absolute
          } else if (trimmed.startsWith('/')) {
            fullUrl = finalOrigin + trimmed;    // absolute path → correct origin
          } else {
            fullUrl = finalDir + trimmed;       // relative path → final directory
          }
          return `/api/proxy?url=${encodeURIComponent(fullUrl)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
      });
    } else {
      // Raw stream / TS segment / MP4 — pipe directly
      res.setHeader('Content-Type', contentType || 'video/MP2T');

      // Forward range-related headers from upstream so iOS Safari can seek
      if (upstream.headers['content-length']) {
        res.setHeader('Content-Length', upstream.headers['content-length'] as string);
      }
      if (upstream.headers['content-range']) {
        res.setHeader('Content-Range', upstream.headers['content-range'] as string);
      }

      // Use 206 if upstream responded with partial content, otherwise 200
      const statusCode = upstream.status === 206 ? 206 : 200;
      res.status(statusCode);

      // When client disconnects (closes player), destroy upstream to free resources
      req.on('close', () => upstream.data.destroy());
      upstream.data.pipe(res);
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).send('Proxy upstream error: ' + err.message);
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
          : await searchMovie(name, 'pt-BR');
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
  const { username, password, sessionId: clientSessionId } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    return;
  }
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
    const matchedOrigin = await validateCredentials(username, password);
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

app.listen(PORT, () => {
  console.log(`🚀 Krator+ Server running on port ${PORT}`);

  // Preload all playlists into memory so first login is instant
  preloadAllPlaylists();

  // Schedule automatic M3U refresh at 3:00 AM daily
  scheduleNightlyRefresh();

  // Start credential lease cleanup (every 60s, removes leases inactive > 5min)
  startLeaseCleanup();
});
