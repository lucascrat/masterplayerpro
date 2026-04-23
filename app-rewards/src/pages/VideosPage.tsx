import { useState } from 'react';
import { useProfile } from '../lib/profile';
import { requestAdNonce, creditVideo } from '../api/client';
import { showRewarded, AD_UNITS } from '../lib/admob';
import GlassCard from '../components/GlassCard';

type Phase = 'idle' | 'loading' | 'playing' | 'crediting' | 'success' | 'error';

export default function VideosPage() {
  const { profile, deviceId, daily, refresh, setProfile } = useProfile();
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const reachedLimit = !!daily && daily.dailyCount >= daily.dailyMax;

  async function watchVideo() {
    if (!deviceId) return;
    setPhase('loading');
    setMsg(null);
    try {
      const { nonce } = await requestAdNonce(deviceId, AD_UNITS.rewarded);
      setPhase('playing');
      const reward = await showRewarded();
      if (!reward) throw new Error('Sem recompensa');
      setPhase('crediting');
      const updated = await creditVideo(deviceId, nonce, AD_UNITS.rewarded);
      setProfile(updated);
      await refresh();
      setPhase('success');
      setMsg(`+1 moeda! Você tem ${updated.coins} moedas (${updated.coins * 2}h).`);
      setTimeout(() => setPhase('idle'), 3500);
    } catch (e: any) {
      setPhase('error');
      const text =
        e?.response?.data?.error ||
        (e?.message === 'dismissed_without_reward' && 'Você saiu antes de terminar o vídeo.') ||
        (e?.message?.startsWith('ad_load_failed') && 'Nenhum anúncio disponível agora. Tente em 1 minuto.') ||
        e?.message ||
        'Erro ao processar';
      setMsg(text);
      setTimeout(() => setPhase('idle'), 4000);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Ganhe moedas</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Assista vídeos curtos para ganhar moedas de acesso ao Krator+.
        </p>
      </div>

      {/* Main action */}
      <GlassCard neon="accent" className="p-6">
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-tertiary-container/25 blur-[60px] rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-primary-container/20 blur-[60px] rounded-full" />
        <div className="relative text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-tertiary to-primary flex items-center justify-center neon-glow-accent">
                <span
                  className="material-symbols-outlined text-white text-5xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  play_circle
                </span>
              </div>
              {phase === 'playing' && <div className="absolute inset-0 rounded-full border-4 border-white/50 animate-ping" />}
            </div>
          </div>

          <div>
            <div className="text-2xl font-bold">Vídeo premiado</div>
            <div className="text-sm text-on-surface-variant">
              +1 moeda por vídeo · 2h de acesso
            </div>
          </div>

          <button
            onClick={watchVideo}
            disabled={phase !== 'idle' || reachedLimit}
            className="w-full bg-primary-container text-on-primary-container px-6 py-4 rounded-2xl font-bold text-base uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 neon-glow-primary"
          >
            {phase === 'loading' && (
              <>
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full spin" />
                Preparando...
              </>
            )}
            {phase === 'playing' && 'Reproduzindo...'}
            {phase === 'crediting' && 'Creditando...'}
            {phase === 'idle' && (reachedLimit ? 'Limite diário atingido' : 'Assistir agora')}
            {phase === 'success' && (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Ganhou!
              </>
            )}
            {phase === 'error' && 'Tentar de novo'}
          </button>

          {msg && (
            <div
              className={
                'text-sm font-medium ' +
                (phase === 'success' ? 'text-tertiary' : 'text-error')
              }
            >
              {msg}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Daily counter */}
      {daily && (
        <GlassCard className="p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-bold">Progresso diário</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {daily.dailyMax - daily.dailyCount} vídeos restantes hoje
              </p>
            </div>
            <span className="text-2xl font-black text-primary tabular-nums">
              {daily.dailyCount}
              <span className="text-on-surface-variant/50 text-lg">/{daily.dailyMax}</span>
            </span>
          </div>
          <div className="relative h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-tertiary via-primary to-secondary transition-[width] duration-700"
              style={{ width: `${Math.min(100, (daily.dailyCount / daily.dailyMax) * 100)}%` }}
            />
          </div>
        </GlassCard>
      )}

      {/* Current balance */}
      <GlassCard className="p-5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Seu saldo</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-secondary tabular-nums">{profile?.coins ?? 0}</span>
            <span className="text-sm text-on-surface-variant">moedas</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant">Equivale a</div>
          <div className="text-lg font-bold text-primary mt-1">{(profile?.coins ?? 0) * 2}h</div>
        </div>
      </GlassCard>
    </div>
  );
}
