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
        <h1>Settings</h1>
      </div>
      <div className="settings-page">
        <div className="settings-section">
          <h3>Device Information</h3>
          <div className="settings-row">
            <span className="label">MAC Address</span>
            <span className="value" style={{ fontFamily: 'monospace', color: '#ffd700' }}>{mac}</span>
          </div>
          <div className="settings-row">
            <span className="label">Status</span>
            <span className="value" style={{ color: device?.isActive ? '#4caf50' : '#e63946' }}>
              {device?.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="settings-row">
            <span className="label">Device ID</span>
            <span className="value">{device?.id || 'N/A'}</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Playlist</h3>
          <div className="settings-row">
            <span className="label">Name</span>
            <span className="value">{device?.playlist?.name || 'None'}</span>
          </div>
          <div className="settings-row">
            <span className="label">URL</span>
            <span className="value" style={{ fontSize: '0.8rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {device?.playlist?.url || 'None'}
            </span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Application</h3>
          <div className="settings-row">
            <span className="label">App Version</span>
            <span className="value">MasterPlayer Pro v1.0</span>
          </div>
          <div className="settings-row">
            <span className="label">Player</span>
            <span className="value">HTML5 Video</span>
          </div>
        </div>

        {onLogout && (
          <div className="settings-section">
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(230,57,70,0.15)',
                border: '1px solid rgba(230,57,70,0.3)',
                borderRadius: 8,
                padding: '0.75rem 1.5rem',
                color: '#e63946',
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
