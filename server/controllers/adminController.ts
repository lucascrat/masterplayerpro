import { Request, Response } from 'express';
import prisma from '../db';

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
  const playlists = await prisma.playlist.findMany();
  res.json(playlists);
};

export const createPlaylist = async (req: Request, res: Response) => {
  const { name, url, type } = req.body;
  const admin = await prisma.adminUser.findFirst();
  if (!admin) {
    res.status(400).json({ error: 'No admin user found. Create an admin account first.' });
    return;
  }
  const playlist = await prisma.playlist.create({
    data: { name, url, type: type || 'M3U', adminId: admin.id }
  });
  res.json(playlist);
};

export const deletePlaylist = async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  await prisma.playlist.delete({ where: { id } });
  res.json({ success: true });
};
