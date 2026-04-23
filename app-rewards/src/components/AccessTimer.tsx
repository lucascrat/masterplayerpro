import { useEffect, useState } from 'react';
import { useProfile } from '../lib/profile';

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export default function AccessTimer() {
  const { profile } = useProfile();
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile?.accessUntil) return null;
  const left = new Date(profile.accessUntil).getTime() - Date.now();
  if (left <= 0) return null;

  return (
    <div className="inline-flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full border border-primary-container/20 mt-1">
      <span className="material-symbols-outlined text-primary text-sm">schedule</span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
        Sessão ativa: {fmt(left)} restantes
      </span>
    </div>
  );
}
