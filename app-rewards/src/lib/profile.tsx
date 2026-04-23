import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { RewardProfile, DailyStats } from '../types';
import { getDeviceId } from './device';
import { registerDevice, fetchStatus, fetchDaily } from '../api/client';

interface ProfileContextValue {
  deviceId: string | null;
  profile: RewardProfile | null;
  daily: DailyStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setProfile: (p: RewardProfile) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<RewardProfile | null>(null);
  const [daily, setDaily] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    try {
      const [p, d] = await Promise.all([fetchStatus(deviceId), fetchDaily(deviceId)]);
      setProfile(p);
      setDaily(d);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erro ao atualizar');
    }
  }, [deviceId]);

  useEffect(() => {
    (async () => {
      try {
        const id = await getDeviceId();
        setDeviceId(id);
        const p = await registerDevice(id);
        setProfile(p);
        try {
          const d = await fetchDaily(id);
          setDaily(d);
        } catch {
          /* daily is optional on first boot */
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || 'Erro ao conectar');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ProfileContext.Provider value={{ deviceId, profile, daily, loading, error, refresh, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
