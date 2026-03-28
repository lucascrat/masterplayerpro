import type { DeviceInfo } from '../../types';

interface SettingsPageProps {
  mac: string;
  device: DeviceInfo | null;
  onBack: () => void;
  onLogout?: () => void;
}

export default function SettingsPage({ mac, device, onBack, onLogout }: SettingsPageProps) {
  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Configurações</h1>
      </div>
      <div className="settings-page">
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
