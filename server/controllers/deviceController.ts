import { Request, Response } from 'express';
import prisma from '../db';
import { parseM3U } from '../services/m3uService';

export const getDeviceStatus = async (req: Request, res: Response) => {
  const { mac } = req.params;

  try {
    let device = await prisma.device.findUnique({
      where: { macAddress: mac },
      include: { playlist: true }
    });

    if (!device) {
      device = await prisma.device.create({
        data: { macAddress: mac, isActive: false },
        include: { playlist: true }
      });
    }

    if (device.isActive && device.playlist) {
      const playlistData = await parseM3U(device.playlist.url);
      return res.json({ device, playlist: playlistData });
    }

    res.json({ device, playlist: null });
  } catch (error) {
    console.error(`[API] Error for MAC ${mac}:`, error);
    res.status(500).json({ error: 'Server error' });
  }
};
