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
  const { id } = req.params;
  const { macAddress, isActive, playlistId } = req.body;
  const device = await prisma.device.update({
    where: { id },
    data: { macAddress, isActive, playlistId: playlistId || null }
  });
  res.json(device);
};

export const deleteDevice = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.device.delete({ where: { id } });
  res.json({ success: true });
};

export const getPlaylists = async (_req: Request, res: Response) => {
  const playlists = await prisma.playlist.findMany();
  res.json(playlists);
};

export const createPlaylist = async (req: Request, res: Response) => {
  const { name, url } = req.body;
  const playlist = await prisma.playlist.create({ data: { name, url } });
  res.json(playlist);
};

export const deletePlaylist = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.playlist.delete({ where: { id } });
  res.json({ success: true });
};
