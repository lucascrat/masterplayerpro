import { Request, Response } from 'express';
import prisma from '../db';
import { parseM3U } from '../services/m3uService';

// M3U cache — re-parse at most once per 10 minutes per URL
const m3uCache = new Map<string, { data: Awaited<ReturnType<typeof parseM3U>>; fetchedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getCachedPlaylist(url: string) {
  const cached = m3uCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    console.log(`[Cache] Returning cached M3U (age: ${Math.round((Date.now() - cached.fetchedAt) / 1000)}s)`);
    return cached.data;
  }
  const data = await parseM3U(url);
  m3uCache.set(url, { data, fetchedAt: Date.now() });
  return data;
}

export const getDeviceStatus = async (req: Request, res: Response) => {
  const mac = String(req.params['mac']);

  try {
    const existing = await prisma.device.findUnique({
      where: { macAddress: mac },
      include: { playlist: true }
    });

    const device = existing ?? await prisma.device.create({
      data: { macAddress: mac, isActive: false },
      include: { playlist: true }
    });

    if (device.isActive && device.playlist) {
      const playlistData = await getCachedPlaylist(device.playlist.url);
      return res.json({ device, playlist: playlistData });
    }

    res.json({ device, playlist: null });
  } catch (error) {
    console.error(`[API] Error for MAC ${mac}:`, error);
    res.status(500).json({ error: 'Server error' });
  }
};
