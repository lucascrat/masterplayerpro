import { useProfile } from '../lib/profile';

export default function TopBar() {
  const { profile } = useProfile();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0D0118]/85 backdrop-blur-xl border-b border-primary-container/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
      <div className="max-w-xl mx-auto flex justify-between items-center px-5 h-16 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-container to-tertiary-container flex items-center justify-center neon-glow-primary">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </div>
          <span className="font-black tracking-widest text-lg text-primary neon-text-primary">KRATOR+</span>
        </div>

        <div className="flex items-center gap-2 bg-surface-container/60 border border-primary-container/25 rounded-full px-3 py-1.5">
          <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            token
          </span>
          <span className="font-bold text-sm tabular-nums">{profile?.coins ?? '—'}</span>
        </div>
      </div>
    </header>
  );
}
