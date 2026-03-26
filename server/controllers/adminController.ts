import { Request, Response } from 'express';
import prisma from '../db';

// Extract username/password from M3U URL
function extractCredentials(url: string): { username: string; password: string } | null {
  try {
    const u = new URL(url);
    // Format 1: ?username=X&password=Y
    const username = u.searchParams.get('username') || u.searchParams.get('user');
    const password = u.searchParams.get('password') || u.searchParams.get('pass') || u.searchParams.get('pwd');
    if (username && password) return { username, password };

    // Format 2: /username/password/... (Xtream Codes style)
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] !== 'get.php') {
      return { username: parts[0], password: parts[1] };
    }
  } catch {}
  return null;
}

export const getDevices = async (_req: Request, res: Response) => {
  const devices = await prisma.device.findMany({
    include: { playlist: true },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(devices);
};

export const createDevice = async (req: Request, res: Response) => {
  const { macAddress, isActive, playlistId } = req.body;
  const device = await prisma.device.create({
    data: { macAddress, isActive, playlistId: playlistId || null }
  });
  res.json(device);
};

export const updateDevice = async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { macAddress, isActive, playlistId } = req.body;
  const device = await prisma.device.update({
    where: { id },
    data: { macAddress, isActive, playlistId: playlistId || null }
  });
  res.json(device);
};

export const deleteDevice = async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await prisma.device.delete({ where: { id } });
  res.json({ success: true });
};

export const getPlaylists = async (_req: Request, res: Response) => {
  const playlists = await prisma.playlist.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(playlists);
};

export const createPlaylist = async (req: Request, res: Response) => {
  const { name, url, type, username: manualUser, password: manualPass } = req.body;
  if (!name || !url) {
    res.status(400).json({ error: 'Name and URL are required.' });
    return;
  }

  let admin = await prisma.adminUser.findFirst();
  if (!admin) {
    admin = await prisma.adminUser.create({
      data: { email: 'admin@masterplayer.local', password: 'master2024', name: 'Admin' }
    });
  }

  // Auto-extract credentials from URL, allow manual override
  const auto = extractCredentials(url);
  const username = manualUser || auto?.username || null;
  const password = manualPass || auto?.password || null;

  const playlist = await prisma.playlist.create({
    data: { name, url, type: type || 'M3U', adminId: admin.id, username, password }
  });
  res.json(playlist);
};

export const updatePlaylist = async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { name, url, username, password } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (url !== undefined) {
    data.url = url;
    // Re-extract credentials if URL changed and no manual override
    if (!username && !password) {
      const auto = extractCredentials(url);
      if (auto) { data.username = auto.username; data.password = auto.password; }
    }
  }
  if (username !== undefined) data.username = username;
  if (password !== undefined) data.password = password;

  const playlist = await prisma.playlist.update({ where: { id }, data });
  res.json(playlist);
};

export const deletePlaylist = async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await prisma.playlist.delete({ where: { id } });
  res.json({ success: true });
};
