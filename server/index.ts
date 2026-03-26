import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Routes
import deviceRoutes from './routes/deviceRoutes';
import adminRoutes from './routes/adminRoutes';
import { searchMovie, searchSeries } from './services/tmdbService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', deviceRoutes);
app.use('/api/admin', adminRoutes);

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
  console.log(`🚀 MasterPlayerPro Server running on port ${PORT}`);
});
