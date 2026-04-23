import GlassCard from '../components/GlassCard';
import { useProfile } from '../lib/profile';

interface ShopItem {
  id: string;
  title: string;
  subtitle: string;
  price: number; // in coins
  hours: number;
  gradient: string;
  icon: string;
}

const ITEMS: ShopItem[] = [
  {
    id: 'pack-1',
    title: 'Pacote 2 horas',
    subtitle: 'Acesso básico',
    price: 1,
    hours: 2,
    gradient: 'from-primary-container to-tertiary-container',
    icon: 'schedule',
  },
  {
    id: 'pack-2',
    title: 'Pacote 12 horas',
    subtitle: 'Meio dia inteiro',
    price: 6,
    hours: 12,
    gradient: 'from-tertiary to-primary',
    icon: 'hourglass_top',
  },
  {
    id: 'pack-3',
    title: 'Pacote 24 horas',
    subtitle: 'Um dia completo',
    price: 12,
    hours: 24,
    gradient: 'from-secondary to-tertiary',
    icon: 'today',
  },
  {
    id: 'pack-4',
    title: 'Pacote 7 dias',
    subtitle: 'Melhor oferta',
    price: 80,
    hours: 168,
    gradient: 'from-primary via-tertiary to-secondary',
    icon: 'diamond',
  },
];

export default function ShopPage() {
  const { profile } = useProfile();
  const coins = profile?.coins ?? 0;

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Loja</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Cada moeda vale 2h. Use seu código no Krator+ para usar as horas.
        </p>
      </div>

      <GlassCard className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center neon-glow-accent">
          <span className="material-symbols-outlined text-on-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
            token
          </span>
        </div>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Seu saldo</div>
          <div className="text-xl font-black tabular-nums">{coins} moedas</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">Disponível</div>
          <div className="text-xl font-bold text-primary">{coins * 2}h</div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((it) => {
          const canAfford = coins >= it.price;
          return (
            <div
              key={it.id}
              className={`relative overflow-hidden rounded-3xl border border-white/5 p-4 bg-gradient-to-br ${it.gradient} ${
                canAfford ? 'opacity-100' : 'opacity-50 grayscale'
              }`}
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 blur-[40px] rounded-full" />
              <div className="relative space-y-3">
                <div className="w-10 h-10 rounded-xl bg-black/25 backdrop-blur flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-white"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {it.icon}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-white/80">
                    {it.subtitle}
                  </div>
                  <div className="text-base font-bold text-white leading-tight mt-0.5">
                    {it.title}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/15">
                  <div className="flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-white text-[16px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      token
                    </span>
                    <span className="text-sm font-bold text-white tabular-nums">{it.price}</span>
                  </div>
                  <div className="text-xs font-bold text-white/80">{it.hours}h</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <GlassCard className="p-4">
        <div className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-primary mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            info
          </span>
          <div>
            <p className="text-sm font-bold mb-1">Em breve: resgate em gift cards</p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Troque moedas por cupons e recompensas parceiras. Por enquanto, use suas moedas como
              horas de acesso direto ao Krator+.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
