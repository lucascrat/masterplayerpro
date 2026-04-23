export default function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-surface">
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-container to-tertiary-container flex items-center justify-center neon-glow-primary">
          <span className="material-symbols-outlined text-5xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            bolt
          </span>
        </div>
        <div className="absolute inset-0 rounded-3xl bg-primary-container/30 blur-2xl" />
      </div>
      <div className="text-center">
        <div className="font-black text-3xl tracking-widest text-primary neon-text-primary">KRATOR</div>
        <div className="text-xs text-on-surface-variant tracking-[0.3em] mt-1">REWARDS</div>
      </div>
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full spin" />
    </div>
  );
}
