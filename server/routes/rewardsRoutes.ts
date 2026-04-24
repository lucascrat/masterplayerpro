import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../db';

const router = Router();

const COIN_START = 5;
const HOURS_PER_COIN = 2;
const MAX_VIDEOS_PER_DAY = 10;
const MIN_SECONDS_BETWEEN_VIDEOS = 30;
const NONCE_TTL_MINUTES = 5;

// Code format: KRT-XXXXXX (6 chars, no ambiguous 0/O/1/I/L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  const chars = Array.from({ length: 6 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join('');
  return `KRT-${chars}`;
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const exists = await prisma.rewardUser.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error('Could not generate unique code');
}

/**
 * Register a new anonymous reward user on first app open.
 * Idempotent: returns existing row if deviceId already known.
 */
router.post('/register', async (req, res) => {
  const { deviceId } = req.body || {};
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8) {
    res.status(400).json({ error: 'deviceId invalid' });
    return;
  }
  try {
    let user = await prisma.rewardUser.findUnique({ where: { deviceId } });
    if (!user) {
      const code = await generateUniqueCode();
      // Welcome coins: timer starts immediately on first open
      const accessUntil = new Date(Date.now() + COIN_START * HOURS_PER_COIN * 60 * 60 * 1000);
      user = await prisma.rewardUser.create({
        data: { deviceId, code, coins: COIN_START, accessUntil },
      });
    }
    res.json({
      code: user.code,
      coins: user.coins,
      accessUntil: user.accessUntil,
    });
  } catch (err: any) {
    console.error('[Rewards] register error:', err.message);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Status lookup — used by the main Krator+ app after code login,
 * and by the rewards app to refresh the balance.
 */
router.get('/status', async (req, res) => {
  const code = String(req.query['code'] || '').toUpperCase();
  const deviceId = String(req.query['deviceId'] || '');
  if (!code && !deviceId) {
    res.status(400).json({ error: 'code or deviceId required' });
    return;
  }
  try {
    const user = await prisma.rewardUser.findFirst({
      where: code ? { code } : { deviceId },
    });
    if (!user) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({
      code: user.code,
      coins: user.coins,
      accessUntil: user.accessUntil,
    });
  } catch (err: any) {
    console.error('[Rewards] status error:', err.message);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Issues a one-time nonce before the client shows a rewarded ad.
 * The nonce is sent back in /video-watched; the server checks it was issued,
 * is fresh, and hasn't been redeemed.
 */
router.post('/ad-nonce', async (req, res) => {
  const { deviceId, adUnitId } = req.body || {};
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId required' });
    return;
  }
  try {
    const user = await prisma.rewardUser.findUnique({ where: { deviceId } });
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    // Rate limit: one nonce per 30s
    const last = await prisma.videoView.findFirst({
      where: { userId: user.id },
      orderBy: { watchedAt: 'desc' },
    });
    if (last) {
      const secsSince = (Date.now() - last.watchedAt.getTime()) / 1000;
      if (secsSince < MIN_SECONDS_BETWEEN_VIDEOS) {
        res.status(429).json({ error: `aguarde ${Math.ceil(MIN_SECONDS_BETWEEN_VIDEOS - secsSince)}s` });
        return;
      }
    }
    // Daily cap
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await prisma.videoView.count({
      where: { userId: user.id, watchedAt: { gte: since } },
    });
    if (todayCount >= MAX_VIDEOS_PER_DAY) {
      res.status(429).json({ error: 'limite diário atingido', dailyCount: todayCount, dailyMax: MAX_VIDEOS_PER_DAY });
      return;
    }
    const nonce = crypto.randomBytes(24).toString('hex');
    await prisma.adNonce.create({
      data: { userId: user.id, nonce, adUnitId: adUnitId || null },
    });
    res.json({ nonce, dailyCount: todayCount, dailyMax: MAX_VIDEOS_PER_DAY });
  } catch (err: any) {
    console.error('[Rewards] ad-nonce error:', err.message);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Credits 1 coin after a verified rewarded video watch.
 * The client must send back the nonce from /ad-nonce.
 * Future: validate AdMob SSV signature here.
 */
router.post('/video-watched', async (req, res) => {
  const { deviceId, nonce, adUnitId } = req.body || {};
  if (!deviceId || !nonce) {
    res.status(400).json({ error: 'deviceId and nonce required' });
    return;
  }
  try {
    const user = await prisma.rewardUser.findUnique({ where: { deviceId } });
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    const nonceRow = await prisma.adNonce.findUnique({ where: { nonce } });
    if (!nonceRow || nonceRow.userId !== user.id) {
      res.status(403).json({ error: 'invalid nonce' });
      return;
    }
    if (nonceRow.redeemedAt) {
      res.status(409).json({ error: 'nonce already redeemed' });
      return;
    }
    const ageMin = (Date.now() - nonceRow.createdAt.getTime()) / 60_000;
    if (ageMin > NONCE_TTL_MINUTES) {
      res.status(410).json({ error: 'nonce expired' });
      return;
    }

    // Extend accessUntil from max(now, current) — timer starts immediately on earn
    const now = new Date();
    const currentUntil = user.accessUntil;
    const baseTime = currentUntil && currentUntil > now ? currentUntil : now;
    const newAccessUntil = new Date(baseTime.getTime() + HOURS_PER_COIN * 60 * 60 * 1000);

    const [updated] = await prisma.$transaction([
      prisma.rewardUser.update({
        where: { id: user.id },
        data: { coins: { increment: 1 }, accessUntil: newAccessUntil },
      }),
      prisma.videoView.create({
        data: { userId: user.id, adUnitId: adUnitId || null },
      }),
      prisma.adNonce.update({
        where: { id: nonceRow.id },
        data: { redeemedAt: new Date() },
      }),
    ]);

    res.json({ coins: updated.coins, accessUntil: updated.accessUntil });
  } catch (err: any) {
    console.error('[Rewards] video-watched error:', err.message);
    res.status(500).json({ error: 'server error' });
  }
});

/**
 * Daily stats used by the rewards app dashboard.
 */
router.get('/daily', async (req, res) => {
  const deviceId = String(req.query['deviceId'] || '');
  if (!deviceId) {
    res.status(400).json({ error: 'deviceId required' });
    return;
  }
  try {
    const user = await prisma.rewardUser.findUnique({ where: { deviceId } });
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await prisma.videoView.count({
      where: { userId: user.id, watchedAt: { gte: since } },
    });
    res.json({
      dailyCount: todayCount,
      dailyMax: MAX_VIDEOS_PER_DAY,
      coinsPerVideo: 1,
      hoursPerCoin: HOURS_PER_COIN,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'server error' });
  }
});

export default router;
export { COIN_START, HOURS_PER_COIN };
