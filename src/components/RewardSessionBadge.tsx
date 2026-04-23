import { useEffect, useState } from 'react';

interface Props {
  accessUntil: string;
  code: string;
  coins?: number;
}

function fmt(msLeft: number): string {
  if (msLeft < 0) msLeft = 0;
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

export default function RewardSessionBadge({ accessUntil, code, coins }: Props) {
  const [left, setLeft] = useState(() => new Date(accessUntil).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(new Date(accessUntil).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [accessUntil]);

  const urgent = left < 5 * 60 * 1000; // last 5 minutes

  return (
    <div style={{
      position: 'fixed',
      top: 12,
      right: 12,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      background: urgent ? 'rgba(239,68,68,0.18)' : 'rgba(139,92,246,0.18)',
      border: `1px solid ${urgent ? 'rgba(239,68,68,0.45)' : 'rgba(139,92,246,0.45)'}`,
      borderRadius: 999,
      backdropFilter: 'blur(10px)',
      fontSize: '0.78rem',
      color: '#fff',
      fontWeight: 600,
      pointerEvents: 'none',
    }}>
      <span style={{ opacity: 0.75 }}>{code}</span>
      <span>•</span>
      <span>⏱ {fmt(left)}</span>
      {typeof coins === 'number' && (
        <>
          <span>•</span>
          <span>🪙 {coins}</span>
        </>
      )}
    </div>
  );
}
