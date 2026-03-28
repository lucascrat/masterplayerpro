import { useState } from 'react';
import type { DeviceInfo } from '../../types';
import { useInstallPWA } from '../../components/InstallBanner';

interface SettingsPageProps {
  mac: string;
  device: DeviceInfo | null;
  onBack: () => void;
  onLogout?: () => void;
}

// ── iOS instructions inline ──────────────────────────────────────────
function IOSSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      {[
        { n: '1', text: 'Abra o Safari', sub: 'O app deve estar aberto no Safari' },
        { n: '2', text: 'Toque em Compartilhar ⎋', sub: 'Ícone de caixa com seta, na barra inferior' },
        { n: '3', text: 'Toque em "Adicionar à Tela de Início"', sub: 'Role para baixo no menu de opções' },
        { n: '4', text: 'Toque em "Adicionar"', sub: 'O ícone do Krator+ aparecerá na tela inicial' },
      ].map(s => (
        <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 28, height: 28, background: 'rgba(139,92,246,0.2)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 700, color: '#8B5CF6', flexShrink: 0,
          }}>{s.n}</div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e5e5e5' }}>{s.text}</div>
            <div style={{ fontSize: '0.76rem', color: '#9ca3af', marginTop: 2 }}>{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage({ mac, device, onBack, onLogout }: SettingsPageProps) {
  const { canInstall, platform, triggerInstall, hasPrompt } = useInstallPWA();
  const [installing, setInstalling] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [installed, setInstalled] = useState(false);

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIOSSteps(v => !v);
      return;
    }
    setInstalling(true);
    const ok = await triggerInstall();
    setInstalling(false);
    if (ok) setInstalled(true);
  };

  const platformLabel: Record<string, string> = {
    android: 'Android',
    ios: 'iPhone / iPad',
    desktop: 'Computador',
    installed: 'Instalado',
  };

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Configurações</h1>
      </div>
      <div className="settings-page">

        {/* ── Install PWA section ── */}
        <div className="settings-section">
          <h3>📲 Instalar Aplicativo</h3>

          {platform === 'installed' || installed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px', background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12,
            }}>
              <span style={{ fontSize: '1.6rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.95rem' }}>App instalado!</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 2 }}>
                  O Krator+ está na sua tela inicial
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Info card */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
                padding: '12px', background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12,
              }}>
                <div style={{
                  width: 48, height: 48, background: '#8B5CF6', borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', flexShrink: 0, fontWeight: 800, color: '#fff',
                }}>K</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>Krator+</div>
                  <div style={{ fontSize: '0.76rem', color: '#9ca3af' }}>
                    Dispositivo: {platformLabel[platform] || platform}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 14, lineHeight: 1.5 }}>
                Instale o app para acessar sem o navegador, usar em tela cheia e ter acesso rápido pela tela inicial.
              </div>

              {/* Install button */}
              {(canInstall || platform === 'ios') && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  style={{
                    width: '100%', padding: '13px',
                    background: installing ? 'rgba(139,92,246,0.4)' : '#8B5CF6',
                    border: 'none', borderRadius: 12,
                    color: '#fff', fontSize: '0.95rem', fontWeight: 700,
                    cursor: installing ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.2s',
                    marginBottom: showIOSSteps ? 16 : 0,
                  }}
                >
                  {platform === 'ios' ? (
                    showIOSSteps ? '▲ Ocultar instruções' : '📲 Ver como instalar no iPhone'
                  ) : (
                    installing ? 'Instalando...' : '📲 Instalar agora'
                  )}
                </button>
              )}

              {/* iOS step-by-step */}
              {platform === 'ios' && showIOSSteps && <IOSSteps />}

              {/* Desktop: no install prompt available */}
              {!canInstall && platform === 'desktop' && (
                <div style={{ fontSize: '0.82rem', color: '#9ca3af', padding: '10px 0' }}>
                  No computador, acesse pelo Chrome ou Edge e um banner de instalação aparecerá automaticamente.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Device info ── */}
        <div className="settings-section">
          <h3>Informações do Dispositivo</h3>
          <div className="settings-row">
            <span className="label">Endereço MAC</span>
            <span className="value" style={{ fontFamily: 'monospace', color: '#ffd700' }}>{mac}</span>
          </div>
          <div className="settings-row">
            <span className="label">Status</span>
            <span className="value" style={{ color: device?.isActive ? '#4caf50' : '#8B5CF6' }}>
              {device?.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div className="settings-row">
            <span className="label">ID do Dispositivo</span>
            <span className="value">{device?.id || 'N/D'}</span>
          </div>
        </div>

        {/* ── Playlist ── */}
        <div className="settings-section">
          <h3>Playlist</h3>
          <div className="settings-row">
            <span className="label">Nome</span>
            <span className="value">{device?.playlist?.name || 'Nenhuma'}</span>
          </div>
          <div className="settings-row">
            <span className="label">URL</span>
            <span className="value" style={{ fontSize: '0.8rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {device?.playlist?.url || 'Nenhuma'}
            </span>
          </div>
        </div>

        {/* ── App info ── */}
        <div className="settings-section">
          <h3>Aplicativo</h3>
          <div className="settings-row">
            <span className="label">Versão</span>
            <span className="value">Krator+ v1.0</span>
          </div>
          <div className="settings-row">
            <span className="label">Player</span>
            <span className="value">HTML5 Vídeo</span>
          </div>
        </div>

        {/* ── Logout ── */}
        {onLogout && (
          <div className="settings-section">
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 8,
                padding: '0.75rem 1.5rem',
                color: '#8B5CF6',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
                fontFamily: 'inherit',
              }}
            >
              Sair da conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
