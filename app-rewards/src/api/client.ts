import axios from 'axios';
import type { RewardProfile, DailyStats } from '../types';

/**
 * Base URL of the Krator+ backend.
 * - In dev (browser): Vite proxies /api → http://localhost:3001, so empty base works.
 * - In production (Capacitor APK/AAB): the bundled HTML is served from file://,
 *   so we MUST point at the real backend host.
 *
 * Override at build time with:  VITE_API_BASE=https://api.krator.app npm run build
 */
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

export async function registerDevice(deviceId: string): Promise<RewardProfile> {
  const { data } = await api.post('/api/rewards/register', { deviceId });
  return data;
}

export async function fetchStatus(deviceId: string): Promise<RewardProfile> {
  const { data } = await api.get('/api/rewards/status', { params: { deviceId } });
  return data;
}

export async function fetchDaily(deviceId: string): Promise<DailyStats> {
  const { data } = await api.get('/api/rewards/daily', { params: { deviceId } });
  return data;
}

export async function requestAdNonce(deviceId: string, adUnitId?: string): Promise<{ nonce: string; dailyCount: number; dailyMax: number }> {
  const { data } = await api.post('/api/rewards/ad-nonce', { deviceId, adUnitId });
  return data;
}

export async function creditVideo(deviceId: string, nonce: string, adUnitId?: string): Promise<RewardProfile> {
  const { data } = await api.post('/api/rewards/video-watched', { deviceId, nonce, adUnitId });
  return data;
}
