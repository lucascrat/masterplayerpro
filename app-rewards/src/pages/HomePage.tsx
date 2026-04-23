import { useNavigate } from 'react-router-dom';
import { useProfile } from '../lib/profile';
import GlassCard from '../components/GlassCard';
import AccessTimer from '../components/AccessTimer';

export default function HomePage() {
  const nav = useNavigate();
  const { profile, daily } = useProfile();

  const hoursAvailable = (profile?.coins ?? 0) * (daily?.hoursPerCoin ?? 2);

  return (
    <div className="space-y-5 pb-6">
      {/* Balance hero */}
      <GlassCard neon="primary" className="p-6">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary-container/30 blur-[60px] rounded-full" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-tertiary-container/20 blur-[60px] rounded-full" />
        <div className="relative text-center space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-on-surface-variant">
            Saldo atual
          </span>
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center neon-glow-accent">
              <span
                className="material-symbols-outlined text-on-secondary text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                token
              </span>
            </div>
            <span className="text-5xl font-black tabular-nums text-secondary tracking-tight">
              {profile?.coins ?? 0}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            = {hoursAvailable}h de acesso ao Krator+
          </p>
          <AccessTimer />
        </div>
      </GlassCard>

      {/* Primary action — watch video */}
      <button
        onClick={() => nav('/videos')}
        className="relative w-full overflow-hidden rounded-3xl p-5 text-left bg-gradient-to-br from-primary-container to-tertiary-container neon-glow-primary active:scale-[0.98] transition-transform"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_50%)]" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-black/20 backdrop-blur flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              play_circle
            </span>
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">Ganhe agora</div>
            <div className="text-lg font-bold text-white leading-tight">Assistir vídeo</div>
            <div className="text-sm text-white/80 mt-1">+1 moeda = +2h de acesso</div>
          </div>
          <span className="material-symbols-outlined text-white text-2xl">chevron_right</span>
        </div>
      </button>

      {/* Quick grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => nav('/shop')}
          className="bg-surface-container/60 border border-white/5 rounded-2xl p-4 text-left active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-tertiary-container/30 flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-tertiary">shopping_bag</span>
          </div>
          <div className="text-sm font-bold">Loja</div>
          <div className="text-xs text-on-surface-variant">Troque moedas</div>
        </button>
        <button
          onClick={() => nav('/profile')}
          className="bg-surface-container/60 border border-white/5 rounded-2xl p-4 text-left active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-container/30 flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-primary">qr_code_2</span>
          </div>
          <div className="text-sm font-bold">Meu código</div>
          <div className="text-xs text-on-surface-variant tabular-nums">{profile?.code ?? '—'}</div>
        </button>
      </div>

      {/* Daily progress */}
      {daily && (
        <GlassCard className="p-5">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-base font-bold">Vídeos hoje</h3>
            <span className="text-primary font-bold text-sm">
              {daily.dailyCount}/{daily.dailyMax}
            </span>
          </div>
          <div className="relative h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-tertiary to-primary"
              style={{ width: `${Math.min(100, (daily.dailyCount / daily.dailyMax) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-on-surface-variant mt-3">
            Limite diário de {daily.dailyMax} vídeos — volta à meia-noite.
          </p>
        </GlassCard>
      )}

      {/* How it works */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-base font-bold">Como funciona</h3>
        <div className="space-y-2.5">
          {[
            { n: 1, t: 'Assista vídeos premiados e ganhe moedas' },
            { n: 2, t: 'Cada moeda vale 2h de acesso ao Krator+' },
            { n: 3, t: 'Use seu código na tela de login do Krator+' },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary-container/20 border border-primary-container/40 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                {s.n}
              </div>
              <p className="text-sm text-on-surface-variant">{s.t}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
