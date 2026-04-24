import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import TopBar from './TopBar';

interface Props {
  children: ReactNode;
}

const NAV = [
  { to: '/', icon: 'home', label: 'Início' },
  { to: '/videos', icon: 'play_circle', label: 'Vídeos' },
  { to: '/shop', icon: 'local_activity', label: 'Loja' },
  { to: '/profile', icon: 'person', label: 'Perfil' },
] as const;

export default function Layout({ children }: Props) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-surface" style={{ paddingBottom: 'calc(80px + 60px + env(safe-area-inset-bottom))' }}>
      <TopBar />
      <main className="pt-20 px-5 max-w-xl mx-auto">{children}</main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Ad banner space — 60px placeholder so nav sits above it */}
        <div style={{ height: 60 }} />

        <div className="bg-[#0B0120]/95 backdrop-blur-2xl border-t border-primary-container/25 shadow-[0_-8px_30px_rgba(13,1,24,0.9)]">
          <div className="max-w-xl mx-auto flex justify-around items-center px-2 py-2">
            {NAV.map((item) => {
              const active =
                item.to === '/'
                  ? loc.pathname === '/'
                  : loc.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 active:scale-90 transition-transform duration-150 select-none"
                >
                  {/* M3 pill indicator */}
                  <div
                    className={[
                      'relative flex items-center justify-center h-8 w-16 rounded-full transition-all duration-200',
                      active ? 'bg-primary-container/30' : 'bg-transparent',
                    ].join(' ')}
                  >
                    {active && (
                      <div className="absolute inset-0 rounded-full bg-primary/10 blur-sm" />
                    )}
                    <span
                      className={[
                        'relative material-symbols-outlined text-[22px] transition-all duration-200',
                        active ? 'text-primary' : 'text-on-surface-variant/55',
                      ].join(' ')}
                      style={{
                        fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      {item.icon}
                    </span>
                  </div>
                  <span
                    className={[
                      'text-[10px] font-bold uppercase tracking-widest transition-colors duration-200',
                      active ? 'text-primary' : 'text-on-surface-variant/50',
                    ].join(' ')}
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
