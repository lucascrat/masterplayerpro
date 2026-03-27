import { useState, useEffect } from 'react';

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return prompt;
}

export default function InstallBanner() {
  const installPrompt = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('pwa_dismissed'));

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
        fontSize: '1.4rem', flexShrink: 0,
      }}>▶</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Instalar Krator+</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Adicionar à tela inicial</div>
      </div>
      <button onClick={install} style={{
        background: '#8B5CF6', color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 16px', fontSize: '0.85rem',
        fontWeight: 600, cursor: 'pointer', flexShrink: 0,
      }}>Instalar</button>
      <button onClick={() => { setDismissed(true); localStorage.setItem('pwa_dismissed', '1'); }} style={{
        background: 'transparent', color: '#6b7280', border: 'none',
        fontSize: '1.2rem', cursor: 'pointer', padding: '4px', flexShrink: 0,
      }}>✕</button>
    </div>
  );
}
