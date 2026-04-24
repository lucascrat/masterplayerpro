import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { useProfile } from '../lib/profile';

interface Pack {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  hours: number;
  gradient: string;
  icon: string;
  badge?: string;
}

const PACKS: Pack[] = [
  {
    id: 'p1',
    title: '2 horas',
    subtitle: 'Acesso básico',
    price: 1,
    hours: 2,
    gradient: 'from-primary-container to-secondary-container',
    icon: 'schedule',
  },
  {
    id: 'p2',
    title: '12 horas',
    subtitle: 'Meio dia',
    price: 6,
    hours: 12,
    gradient: 'from-tertiary to-primary',
    icon: 'hourglass_top',
  },
  {
    id: 'p3',
    title: '24 horas',
    subtitle: 'Dia completo',
    price: 12,
    hours: 24,
    gradient: 'from-secondary to-tertiary',
    icon: 'today',
  },
  {
    id: 'p4',
    title: '7 dias',
    subtitle: 'Melhor oferta',
    price: 80,
    hours: 168,
    gradient: 'from-primary via-tertiary to-secondary',
    icon: 'diamond',
    badge: 'TOP',
  },
];

export default function ShopPage() {
  const { profile } = useProfile();
  const nav = useNavigate();
  const coins = profile?.coins ?? 0;
  const totalHours = coins * 2;

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Loja de horas</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Cada moeda = 2h de acesso. Use seu código no Krator+.
        </p>
      </div>

      {/* Balance summary */}
      <GlassCard neon="primary" className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-secondary text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                token
              </span>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Seu saldo</div>
              <div className="text-2xl font-black tabular-nums">
                {coins} <span className="text-base font-semibold text-on-surface-variant">moedas</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Equivale a</div>
            <div className="text-2xl font-black text-primary tabular-nums">{totalHours}h</div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/8">
          <button
            onClick={() => nav('/profile')}
            className="w-full bg-primary-container text-on-primary-container rounded-2xl py-3 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform neon-glow-primary"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              qr_code_2
            </span>
            Ver meu código de acesso
          </button>
        </div>
      </GlassCard>

      {/* Packs grid */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-3">
          O que você pode desbloquear
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {PACKS.map((pack) => {
            const canAfford = coins >= pack.price;
            return (
              <div
                key={pack.id}
                className={[
                  'relative overflow-hidden rounded-3xl border p-4',
                  `bg-gradient-to-br ${pack.gradient}`,
                  canAfford
                    ? 'border-white/15 opacity-100'
                    : 'border-white/5 opacity-40 grayscale',
                ].join(' ')}
              >
                {/* Badge */}
                {pack.badge && canAfford && (
                  <div className="absolute top-3 right-3 bg-white/20 backdrop-blur rounded-full px-2 py-0.5 text-[10px] font-black text-white tracking-widest">
                    {pack.badge}
                  </div>
                )}

                <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/10 blur-[35px] rounded-full" />
                <div className="relative space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-black/20 backdrop-blur flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-white"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {pack.icon}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {pack.subtitle}
                    </div>
                    <div className="text-lg font-black text-white leading-tight mt-0.5">
                      {pack.title}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/15">
                    <div className="flex items-center gap-1">
                      <span
                        className="material-symbols-outlined text-white text-[15px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        token
                      </span>
                      <span className="text-sm font-bold text-white tabular-nums">{pack.price}</span>
                    </div>
                    <div className="text-xs font-bold text-white/80">{pack.hours}h</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How to redeem */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Como resgatar
        </h3>
        <div className="space-y-3">
          {[
            { icon: 'smart_display', text: 'Assista vídeos para ganhar moedas' },
            { icon: 'qr_code_2', text: 'Copie seu código na aba Perfil' },
            { icon: 'login', text: 'Cole o código na tela de login do Krator+' },
            { icon: 'live_tv', text: 'Acesso liberado automaticamente!' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-container/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  {s.icon}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">{s.text}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => nav('/videos')}
          className="w-full bg-surface-container-highest rounded-2xl py-3 font-bold text-sm text-on-surface flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_circle
          </span>
          Ganhar mais moedas
        </button>
      </GlassCard>
    </div>
  );
}
