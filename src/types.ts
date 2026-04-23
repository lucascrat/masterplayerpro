export interface M3UItem {
  name: string;
  logo: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
}

export interface PlaylistData {
  live: M3UItem[];
  movies: M3UItem[];
  series: M3UItem[];
}

export interface DeviceInfo {
  id: string;
  macAddress: string;
  isActive: boolean;
  playlist: { name: string; url: string; } | null;
}

export interface AuthSession {
  username: string;
  password: string;
  playlistName: string;
  userId?: string;
  sessionId?: string;
  // Rewards-app code session: when set, access expires at this instant.
  rewardCode?: string;
  accessUntil?: string; // ISO timestamp
  coins?: number;
}

export type Page = 'loading' | 'login' | 'home' | 'livetv' | 'movies' | 'series' | 'search' | 'settings';
