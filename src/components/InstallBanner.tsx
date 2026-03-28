import { useState, useEffect } from 'react';

// ── Device detection helpers ─────────────────────────────────────────
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

// ── Hook: Android install prompt ─────────────────────────────────────
function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return prompt;
}

// ── iOS instructions modal ───────────────────────────────────────────
function IOSInstructions({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1a2e',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 40px',
          width: '100%',
          maxWidth: 480,
          border: '1px solid rgba(139,92,246,0.3)',
          borderBottom: 'none',
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 40, height: 4, background: 'rgba(255,255,255,0.2)',
          borderRadius: 2, margin: '0 auto 20px',
        }} />

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, background: '#8B5CF6', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', flexShrink: 0,
          }}>K</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>Instalar Krator+</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Adicionar à tela inicial do iPhone</div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { num: '1', icon: '⎋', text: 'Toque no botão Compartilhar', sub: 'Ícone de caixa com seta para cima, na barra do Safari' },
            { num: '2', icon: '＋', text: 'Toque em "Adicionar à Tela de Início"', sub: 'Role para baixo na lista de opções do menu' },
            { num: '3', icon: '✓', text: 'Toque em "Adicionar"', sub: 'O app aparecerá na sua tela inicial' },
          ].map(step => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 32, height: 32, background: 'rgba(139,92,246,0.2)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: '#8B5CF6', fontWeight: 700, flexShrink: 0,
              }}>{step.num}</div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{step.text}</div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{step.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Arrow pointing to share button */}
        <div style={{
          marginTop: 20, padding: '10px 14px',
          background: 'rgba(139,92,246,0.1)', borderRadius: 10,
          border: '1px solid rgba(139,92,246,0.2)',
          fontSize: '0.82rem', color: '#c4b5fd', textAlign: 'center',
        }}>
          📲 Após instalar, abra o app pela tela inicial para ter a melhor experiência
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: '100%', padding: '12px',
            background: '#8B5CF6', border: 'none', borderRadius: 12,
            color: '#fff', fontSize: '0.95rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────
export default function InstallBanner() {
  const installPrompt = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('pwa_dismissed'));
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Don't show anything if already installed as PWA
  if (isInStandaloneMode()) return null;

  // ── iOS: show floating hint banner → tapping opens instruction modal ──
  if (isIOS()) {
    const iosDismissed = !!localStorage.getItem('pwa_ios_dismissed');
    if (iosDismissed && !showIOSGuide) return null;

    return (
      <>
        {!iosDismissed && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8888,
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderTop: '1px solid rgba(139,92,246,0.3)',
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            gap: '12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              width: 44, height: 44, background: '#8B5CF6', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem', flexShrink: 0, fontWeight: 800, color: '#fff',
            }}>K</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Instalar Krator+</div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                Toque em <strong style={{ color: '#c4b5fd' }}>Compartilhar ⎋</strong> → Adicionar à Tela de Início
              </div>
            </div>
            <button onClick={() => setShowIOSGuide(true)} style={{
              background: '#8B5CF6', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
            }}>Ver como</button>
            <button onClick={() => { localStorage.setItem('pwa_ios_dismissed', '1'); window.location.reload(); }} style={{
              background: 'transparent', color: '#6b7280', border: 'none',
              fontSize: '1.2rem', cursor: 'pointer', padding: '4px', flexShrink: 0,
            }}>✕</button>
          </div>
        )}
        {showIOSGuide && <IOSInstructions onClose={() => setShowIOSGuide(false)} />}
      </>
    );
  }

  // ── Android / Desktop: use beforeinstallprompt ────────────────────
  if (!installPrompt || dismissed) return null;

  const install = async () => {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setDismissed(true);
    else { setDismissed(true); localStorage.setItem('pwa_dismissed', '1'); }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 8888,
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      borderTop: '1px solid rgba(139,92,246,0.3)',
      padding: '12px 16px', display: 'flex', alignItems: 'center',
      gap: '12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        width: 44, height: 44, background: '#8B5CF6', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.3rem', flexShrink: 0, fontWeight: 800, color: '#fff',
      }}>K</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Instalar Krator+</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Adicionar à tela inicial do seu dispositivo</div>
      </div>
      <button onClick={install} style={{
        background: '#8B5CF6', color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 16px', fontSize: '0.85rem',
        fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
      }}>Instalar</button>
      <button onClick={() => { setDismissed(true); localStorage.setItem('pwa_dismissed', '1'); }} style={{
        background: 'transparent', color: '#6b7280', border: 'none',
        fontSize: '1.2rem', cursor: 'pointer', padding: '4px', flexShrink: 0,
      }}>✕</button>
    </div>
  );
}

// ── Exported hook + button for use in SettingsPage ───────────────────
export function useInstallPWA() {
  const prompt = useInstallPrompt();

  const canInstall = !isInStandaloneMode() && (!!prompt || isIOS() || isAndroid());
  const platform: 'android' | 'ios' | 'desktop' | 'installed' =
    isInStandaloneMode() ? 'installed' :
    isIOS() ? 'ios' :
    isAndroid() ? 'android' :
    'desktop';

  const triggerInstall = async (): Promise<boolean> => {
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      return outcome === 'accepted';
    }
    return false;
  };

  return { canInstall, platform, triggerInstall, hasPrompt: !!prompt };
}
