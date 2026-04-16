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
import { getPlaylist, preloadAllPlaylists, scheduleNightlyRefresh, validateCredentials, getPlaylistForUser, getPlaylistForUserAnyServer, loadPlaylistOnDemand } from './services/m3uService';
import prisma from './db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Startup migration: add username/password columns to playlists if missing
prisma.$executeRawUnsafe(`
  ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password TEXT
`).then(() => console.log('[DB] Playlist credentials columns ready'))
  .catch((e: any) => console.log('[DB] Migration note:', e.message));

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

// Client login — validates credentials against ALL configured IPTV servers
// and serves cached content with URLs rewritten for the user.
// No need to register each user in the DB — any valid IPTV account works.
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    return;
  }
  try {
    // Validate credentials against all configured servers (in parallel)
    const matchedOrigin = await validateCredentials(username, password);
    if (!matchedOrigin) {
      res.status(401).json({ error: 'Usuário ou senha incorretos' });
      return;
    }

    // Serve cached content from the matched server
    const cached = getPlaylistForUser(username, password, matchedOrigin);
    if (cached) {
      res.json({ success: true, playlistName: 'Krator+', playlist: cached });
      return;
    }

    // Cache not ready — load on the fly (first login or preload failed)
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
});
