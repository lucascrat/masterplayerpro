import { Request, Response } from 'express';
import prisma from '../db';

export const toggleFavorite = async (req: Request, res: Response) => {
  const { appUserId, deviceId, itemName, itemType, itemGroup, itemLogo, itemUrl } = req.body;

  if ((!appUserId && !deviceId) || !itemName || !itemType || !itemUrl) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // We must find by the unique constraint that matches our input
    const filter: any = {};
    if (appUserId) filter.appUserId = appUserId;
    else filter.deviceId = deviceId;
    
    const existing = await prisma.userFavorite.findFirst({
      where: {
        ...filter,
        itemName,
        itemType
      }
    });

    if (existing) {
      await prisma.userFavorite.delete({ where: { id: existing.id } });
      res.json({ success: true, action: 'removed' });
    } else {
      const created = await prisma.userFavorite.create({
        data: {
          appUserId: appUserId || null,
          deviceId: deviceId || null,
          itemName,
          itemType,
          itemGroup,
          itemLogo,
          itemUrl
        }
      });
      res.json({ success: true, action: 'added', favorite: created });
    }
  } catch (err: any) {
    console.error('[Favorites] Error toggling:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getFavorites = async (req: Request, res: Response) => {
  const { appUserId, deviceId } = req.query;

  if (!appUserId && !deviceId) {
    res.status(400).json({ error: 'appUserId or deviceId required' });
    return;
  }

  try {
    const favorites = await prisma.userFavorite.findMany({
      where: appUserId ? { appUserId: String(appUserId) } : { deviceId: String(deviceId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(favorites);
  } catch (err: any) {
    console.error('[Favorites] Error fetching:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};
