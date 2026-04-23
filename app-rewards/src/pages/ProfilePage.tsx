import { useState } from 'react';
import { useProfile } from '../lib/profile';
import GlassCard from '../components/GlassCard';
import AccessTimer from '../components/AccessTimer';

export default function ProfilePage() {
  const { profile, daily } = useProfile();
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!profile?.code) return;
    try {
      await navigator.clipboard.writeText(profile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Meu perfil</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Use este código na tela de login do Krator+.
        </p>
      </div>

      {/* Code card */}
      <GlassCard neon="primary" className="p-6">
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary-container/30 blur-[60px] rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-tertiary-container/20 blur-[60px] rounded-full" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">qr_code_2</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-on-surface-variant">
              Código de acesso
            </span>
          </div>
          <div className="py-2">
            <div className="text-center font-black text-4xl tracking-[0.15em] text-primary neon-text-primary tabular-nums">
              {profile?.code ?? '—'}
            </div>
          </div>
          <button
            onClick={copyCode}
            className="w-full bg-primary-container/20 border border-primary-container/40 text-primary px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copiado!' : 'Copiar código'}
          </button>
          <AccessTimer />
        </div>
      </GlassCard>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center mb-2">
            <span
              className="material-symbols-outlined text-secondary text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              token
            </span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Moedas</div>
          <div className="text-2xl font-black tabular-nums">{profile?.coins ?? 0}</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="w-9 h-9 rounded-xl bg-primary-container/20 flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Horas</div>
          <div className="text-2xl font-black tabular-nums text-primary">
            {(profile?.coins ?? 0) * 2}h
          </div>
        </GlassCard>

        {daily && (
          <>
            <GlassCard className="p-4">
              <div className="w-9 h-9 rounded-xl bg-tertiary-container/25 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-tertiary text-[20px]">
                  play_circle
                </span>
              </div>
              <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Hoje</div>
              <div className="text-2xl font-black tabular-nums">
                {daily.dailyCount}
                <span className="text-on-surface-variant/50 text-base">/{daily.dailyMax}</span>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="w-9 h-9 rounded-xl bg-primary-container/20 flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
              </div>
              <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">
                Valor
              </div>
              <div className="text-2xl font-black tabular-nums text-primary">
                +{daily.coinsPerVideo}
              </div>
            </GlassCard>
          </>
        )}
      </div>

      {/* How to use */}
      <GlassCard className="p-5 space-y-3">
        <h3 className="text-base font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">help</span>
          Como usar seu código
        </h3>
        <ol className="space-y-2.5">
          {[
            'Abra o app Krator+ no seu dispositivo',
            'Na tela de login, toque em "Código"',
            'Digite seu código acima (KRT-XXXXXX)',
            'Comece a assistir — cada moeda = 2h',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-container/25 border border-primary-container/40 flex items-center justify-center text-primary font-bold text-xs shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-on-surface-variant">{t}</p>
            </li>
          ))}
        </ol>
      </GlassCard>

      {/* Footer */}
      <div className="text-center pt-2">
        <div className="text-xs text-on-surface-variant/50">Krator Rewards · v1.0</div>
      </div>
    </div>
  );
}
