import { useProfile } from '../lib/profile';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Início',
  '/videos': 'Ganhar moedas',
  '/shop': 'Loja de horas',
  '/profile': 'Meu perfil',
};

export default function TopBar() {
  const { profile } = useProfile();
  const loc = useLocation();
  const title = PAGE_TITLES[loc.pathname] ?? 'Krator+';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 bg-[#0B0120]/90 backdrop-blur-xl border-b border-primary-container/20 shadow-[0_0_15px_rgba(168,85,247,0.12)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-xl mx-auto flex justify-between items-center px-5 h-16 relative">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-container to-tertiary-container flex items-center justify-center neon-glow-primary">
            <span
              className="material-symbols-outlined text-white text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bolt
            </span>
          </div>
          <span className="font-black tracking-widest text-base text-primary neon-text-primary hidden sm:block">
            KRATOR+
          </span>
        </div>

        {/* Page title — centered absolutely */}
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-on-surface/80 tracking-wide">
          {title}
        </span>

        {/* Coin badge */}
        <div className="flex items-center gap-1.5 bg-surface-container/60 border border-primary-container/25 rounded-full px-3 py-1.5 shrink-0">
          <span
            className="material-symbols-outlined text-secondary text-[17px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            token
          </span>
          <span className="font-bold text-sm tabular-nums">{profile?.coins ?? '—'}</span>
        </div>
      </div>
    </header>
  );
}
