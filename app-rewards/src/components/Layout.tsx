import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import TopBar from './TopBar';

interface Props {
  children: ReactNode;
}

const NAV = [
  { to: '/', icon: 'grid_view', label: 'Início' },
  { to: '/videos', icon: 'play_circle', label: 'Vídeos' },
  { to: '/shop', icon: 'shopping_bag', label: 'Loja' },
  { to: '/profile', icon: 'person', label: 'Perfil' },
] as const;

export default function Layout({ children }: Props) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-surface pb-28">
      <TopBar />
      <main className="pt-20 px-5 max-w-xl mx-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D0118]/85 backdrop-blur-xl border-t border-primary-container/20 shadow-[0_-10px_25px_rgba(13,1,24,0.8)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto flex justify-around items-center px-2 pt-2 pb-3">
          {NAV.map((item) => {
            const active = item.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all active:scale-90 ' +
                  (active
                    ? 'text-primary bg-primary-container/15 neon-text-primary'
                    : 'text-on-surface-variant/70 hover:text-on-surface')
                }
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
