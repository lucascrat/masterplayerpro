import { useEffect, useState } from 'react';
import { useProfile } from '../lib/profile';

function fmtDetailed(ms: number) {
  if (ms <= 0) return { h: 0, m: 0, s: 0, total: 0 };
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s, total };
}

interface AccessTimerProps {
  /** compact: small pill. full: large countdown hero */
  variant?: 'compact' | 'full';
}

export default function AccessTimer({ variant = 'compact' }: AccessTimerProps) {
  const { profile } = useProfile();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile?.accessUntil) return null;
  const until = new Date(profile.accessUntil).getTime();
  const left = until - now;
  if (left <= 0) return null;

  const { h, m, s } = fmtDetailed(left);
  const urgent = left < 30 * 60 * 1000; // < 30 min = red alert

  if (variant === 'full') {
    return (
      <div className={`rounded-2xl p-4 border ${urgent ? 'bg-error/10 border-error/30' : 'bg-black/30 border-primary-container/25'}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`material-symbols-outlined text-sm ${urgent ? 'text-error' : 'text-primary'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}>
            {urgent ? 'alarm' : 'timer'}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${urgent ? 'text-error' : 'text-on-surface-variant'}`}>
            {urgent ? 'Expirando em breve' : 'Acesso ativo'}
          </span>
        </div>
        <div className="flex items-end gap-1 tabular-nums">
          <span className={`text-4xl font-black leading-none ${urgent ? 'text-error' : 'text-primary'}`}>
            {String(h).padStart(2, '0')}
          </span>
          <span className={`text-2xl font-black mb-0.5 ${urgent ? 'text-error/60' : 'text-primary/50'}`}>:</span>
          <span className={`text-4xl font-black leading-none ${urgent ? 'text-error' : 'text-primary'}`}>
            {String(m).padStart(2, '0')}
          </span>
          <span className={`text-2xl font-black mb-0.5 ${urgent ? 'text-error/60' : 'text-primary/50'}`}>:</span>
          <span className={`text-4xl font-black leading-none ${urgent ? 'text-error' : 'text-on-surface-variant'}`}>
            {String(s).padStart(2, '0')}
          </span>
        </div>
        <p className="text-[10px] text-on-surface-variant mt-1.5">
          horas : minutos : segundos restantes
        </p>
      </div>
    );
  }

  // compact pill
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border mt-1 ${
      urgent
        ? 'bg-error/15 border-error/30'
        : 'bg-black/30 border-primary-container/20'
    }`}>
      <span className={`material-symbols-outlined text-[14px] ${urgent ? 'text-error' : 'text-primary'}`}
        style={{ fontVariationSettings: "'FILL' 1" }}>
        timer
      </span>
      <span className={`text-[11px] font-bold tabular-nums ${urgent ? 'text-error' : 'text-primary'}`}>
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
      <span className={`text-[10px] uppercase tracking-widest ${urgent ? 'text-error/70' : 'text-on-surface-variant'}`}>
        restante
      </span>
    </div>
  );
}
