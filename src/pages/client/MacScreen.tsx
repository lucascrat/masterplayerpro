import { DeviceInfo } from '../../types';
import Logo from '../../components/Logo';

interface MacScreenProps {
  mac: string;
  device: DeviceInfo | null;
  error: string | null;
  onRefresh: () => void;
}

export default function MacScreen({ mac, device, error, onRefresh }: MacScreenProps) {
  return (
    <div className="mac-screen">
      <Logo size="large" />
      <div className="mac-display">
        <h2>Your Device MAC Address</h2>
        <div className="mac-address">{mac}</div>
      </div>
      <div className={`mac-status ${device?.isActive ? 'active' : 'inactive'}`}>
        {device?.isActive ? '● Activated' : '● Waiting for Activation'}
      </div>
      <p className="mac-info">
        Send this MAC address to your provider to activate your subscription and link a playlist.
      </p>
      <button
        onClick={onRefresh}
        style={{
          background: 'linear-gradient(135deg, #e63946, #b71c2c)',
          color: '#fff',
          border: 'none',
          padding: '0.8rem 2rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Refresh Status
      </button>
      {error && <p style={{ color: '#e63946', fontSize: '0.85rem' }}>{error}</p>}
    </div>
  );
}
