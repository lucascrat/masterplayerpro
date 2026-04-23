import type { ReactNode, HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  neon?: 'primary' | 'accent' | 'none';
}

export default function GlassCard({ children, neon = 'none', className = '', ...rest }: Props) {
  const glow = neon === 'primary' ? 'neon-glow-primary' : neon === 'accent' ? 'neon-glow-accent' : '';
  return (
    <div
      {...rest}
      className={`relative overflow-hidden rounded-3xl border border-white/5 bg-surface-container/60 backdrop-blur-md ${glow} ${className}`}
    >
      {children}
    </div>
  );
}
