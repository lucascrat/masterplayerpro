// ── REST API client ─────────────────────────────────────────────────
// The whole app talks to the bundled Express server under /api. No
// third-party BaaS. All calls are same-origin.

import type { PlaylistData } from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!res.ok) {
    const msg = (body && typeof body === 'object' && body.error) ? body.error : (typeof body === 'string' && body) || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

// ── Auth ────────────────────────────────────────────────────────────

export interface LoginResult {
  success: true;
  playlistName: string;
  playlist: PlaylistData;
  userId?: string;
  sessionId?: string;
  code?: string;
  coins?: number;
  accessUntil?: string;
}

export function login(username: string, password: string, sessionId?: string) {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, sessionId }),
  });
}

export function redeemCode(code: string, sessionId?: string) {
  return request<LoginResult>('/auth/redeem-code', {
    method: 'POST',
    body: JSON.stringify({ code, sessionId }),
  });
}

export function heartbeat(sessionId: string, isWatching: boolean) {
  return request<{ success: boolean }>('/auth/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ sessionId, isWatching }),
  }).catch(() => ({ success: false }));
}

export function logout(sessionId: string) {
  return request<{ success: boolean }>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  }).catch(() => ({ success: false }));
}

/** Fire-and-forget logout for pagehide/beforeunload. */
export function logoutBeacon(sessionId: string) {
  try {
    const blob = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' });
    navigator.sendBeacon('/api/auth/logout', blob);
  } catch {
    logout(sessionId);
  }
}

// ── Favorites ───────────────────────────────────────────────────────

export interface FavoriteRow {
  id: string;
  appUserId: string | null;
  deviceId: string | null;
  itemName: string;
  itemType: 'live' | 'movie' | 'series';
  itemGroup: string | null;
  itemLogo: string | null;
  itemUrl: string;
  createdAt: string;
}

export function getFavorites(owner: { appUserId?: string; deviceId?: string }) {
  const q = owner.appUserId ? `appUserId=${encodeURIComponent(owner.appUserId)}` : `deviceId=${encodeURIComponent(owner.deviceId || '')}`;
  return request<FavoriteRow[]>(`/favorites?${q}`);
}

export function toggleFavorite(payload: {
  appUserId?: string | null;
  deviceId?: string | null;
  itemName: string;
  itemType: string;
  itemGroup?: string;
  itemLogo?: string;
  itemUrl: string;
}) {
  return request<{ success: boolean; action: 'added' | 'removed' }>('/favorites/toggle', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Admin ───────────────────────────────────────────────────────────
// The server middleware authorises admin routes by a static key sent in
// the Authorization header (ADMIN_KEY env, default "master2024").

let adminKey = '';
export function setAdminKey(key: string) { adminKey = key; }
export function getAdminKey() { return adminKey; }

function adminReq<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(`/admin${path}`, {
    ...init,
    headers: { Authorization: adminKey, ...(init?.headers || {}) },
  });
}

export const admin = {
  verify: () => adminReq<unknown[]>('/playlists').then(() => true),

  getDevices: () => adminReq<any[]>('/devices'),
  createDevice: (d: { macAddress: string; isActive: boolean; playlistId?: string | null }) =>
    adminReq<any>('/devices', { method: 'POST', body: JSON.stringify(d) }),
  updateDevice: (id: string, d: { macAddress?: string; isActive?: boolean; playlistId?: string | null }) =>
    adminReq<any>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteDevice: (id: string) => adminReq<any>(`/devices/${id}`, { method: 'DELETE' }),

  getPlaylists: () => adminReq<any[]>('/playlists'),
  createPlaylist: (p: { name: string; url: string; type?: string; username?: string; password?: string }) =>
    adminReq<any>('/playlists', { method: 'POST', body: JSON.stringify(p) }),
  updatePlaylist: (id: string, p: { name?: string; url?: string; username?: string; password?: string }) =>
    adminReq<any>(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(p) }),
  deletePlaylist: (id: string) => adminReq<any>(`/playlists/${id}`, { method: 'DELETE' }),

  getAppUsers: () => adminReq<any[]>('/app-users'),
  createAppUser: (u: { username: string; password: string; name?: string }) =>
    adminReq<any>('/app-users', { method: 'POST', body: JSON.stringify(u) }),
  updateAppUser: (id: string, u: Record<string, unknown>) =>
    adminReq<any>(`/app-users/${id}`, { method: 'PATCH', body: JSON.stringify(u) }),
  deleteAppUser: (id: string) => adminReq<any>(`/app-users/${id}`, { method: 'DELETE' }),

  getIptvCredentials: () => adminReq<any[]>('/iptv-credentials'),
  createIptvCredential: (c: { username: string; password: string; playlistId?: string; serverUrl?: string; maxLeases?: number }) =>
    adminReq<any>('/iptv-credentials', { method: 'POST', body: JSON.stringify(c) }),
  deleteIptvCredential: (id: string) => adminReq<any>(`/iptv-credentials/${id}`, { method: 'DELETE' }),
};
