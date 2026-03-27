import type { DeviceInfo } from '../../types';

interface AdminDashboardProps {
  devices: DeviceInfo[];
  playlists: any[];
}

export default function AdminDashboard({ devices, playlists }: AdminDashboardProps) {
  const activeCount = devices.filter(d => d.isActive).length;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your streaming platform</p>
        </div>
      </div>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>📱</div>
          <div>
            <div className="admin-stat-value">{devices.length}</div>
            <div className="admin-stat-label">Total Devices</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>✅</div>
          <div>
            <div className="admin-stat-value">{activeCount}</div>
            <div className="admin-stat-label">Active Devices</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>📁</div>
          <div>
            <div className="admin-stat-value">{playlists.length}</div>
            <div className="admin-stat-label">Playlists</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>📈</div>
          <div>
            <div className="admin-stat-value">100%</div>
            <div className="admin-stat-label">System Health</div>
          </div>
        </div>
      </div>
    </>
  );
}
