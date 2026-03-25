import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// @ts-ignore - Prisma v7 adapter typing
const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// ==========================================
// DEVICE (MAC) ENDPOINTS
// ==========================================

// Register/check device by MAC
app.post('/api/device/register', async (req: any, res: any) => {
  try {
    const { macAddress } = req.body;
    if (!macAddress) return res.status(400).json({ error: 'MAC address required' });

    let device = await prisma.device.findUnique({ where: { macAddress } });
    if (!device) {
      device = await prisma.device.create({ data: { macAddress } });
    }
    res.json(device);
  } catch (err: any) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get device status and playlist
app.get('/api/device/:mac', async (req: any, res: any) => {
  try {
    const device = await prisma.device.findUnique({
      where: { macAddress: req.params.mac },
      include: { playlist: true },
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  } catch (err: any) {
    console.error('Device error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PLAYLIST / M3U ENDPOINTS
// ==========================================

app.get('/api/playlist/:mac', async (req: any, res: any) => {
  try {
    const device = await prisma.device.findUnique({
      where: { macAddress: req.params.mac },
      include: { playlist: true },
    });

    if (!device || !device.isActive || !device.playlist) {
      return res.status(403).json({ error: 'Device not activated or no playlist assigned' });
    }

    const response = await fetch(device.playlist.url);
    const m3uContent = await response.text();
    const parsed = parseM3U(m3uContent);
    res.json(parsed);
  } catch (err: any) {
    console.error('Playlist error:', err.message);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

app.post('/api/admin/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ id: admin.id, email: admin.email, name: admin.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/create', async (req: any, res: any) => {
  try {
    const { email, password, name } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.adminUser.create({
      data: { email, password: hashed, name },
    });
    res.json({ id: admin.id, email: admin.email, name: admin.name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/devices', async (_req: any, res: any) => {
  try {
    const devices = await prisma.device.findMany({
      include: { playlist: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(devices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/device/:id/activate', async (req: any, res: any) => {
  try {
    const { playlistId, isActive } = req.body;
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: { playlistId, isActive: isActive ?? true },
      include: { playlist: true },
    });
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/playlists', async (_req: any, res: any) => {
  try {
    const playlists = await prisma.playlist.findMany({
      include: { _count: { select: { devices: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(playlists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/playlists', async (req: any, res: any) => {
  try {
    const { name, url, type, adminId } = req.body;
    const playlist = await prisma.playlist.create({
      data: { name, url, type: type || 'M3U', adminId },
    });
    res.json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/playlists/:id', async (req: any, res: any) => {
  try {
    await prisma.playlist.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// M3U PARSER
// ==========================================

interface M3UItem {
  name: string;
  logo: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
}

function parseM3U(content: string): { live: M3UItem[]; movies: M3UItem[]; series: M3UItem[] } {
  const lines = content.split('\n');
  const live: M3UItem[] = [];
  const movies: M3UItem[] = [];
  const series: M3UItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;

    const nameMatch = line.match(/,(.+)$/);
    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
    const groupMatch = line.match(/group-title="([^"]*)"/);

    const name = nameMatch?.[1]?.trim() || 'Unknown';
    const logo = logoMatch?.[1] || '';
    const group = groupMatch?.[1] || 'Uncategorized';
    const url = lines[i + 1]?.trim() || '';

    if (!url || url.startsWith('#')) continue;

    const item: M3UItem = { name, logo, group, url, type: 'live' };

    const groupLower = group.toLowerCase();
    if (groupLower.includes('movie') || groupLower.includes('filme') || groupLower.includes('vod')) {
      item.type = 'movie';
      movies.push(item);
    } else if (groupLower.includes('series') || groupLower.includes('série') || groupLower.includes('serie')) {
      item.type = 'series';
      series.push(item);
    } else {
      live.push(item);
    }
  }

  return { live, movies, series };
}

// ==========================================
// SERVE FRONTEND IN PRODUCTION
// ==========================================

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from Vite build
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get('/{*path}', (_req: any, res: any) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`MasterPlayer API running on http://localhost:${PORT}`);
});
