import React from 'react';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function AdminLayout({ children, activeTab, setActiveTab, onLogout }: AdminLayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'devices', label: 'Devices', icon: '📱' },
    { id: 'playlists', label: 'Playlists', icon: '📁' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-icon">MP</div>
          <div>
            <div className="admin-logo-text">KRATOR+</div>
            <div className="admin-logo-sub">ADMIN PANEL</div>
          </div>
        </div>
        <nav className="admin-nav">
          {navItems.map(item => (
            <div
              key={item.id}
              className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
        <div className="admin-user-info">
          <div className="admin-avatar">A</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Administrator</div>
            <div style={{ fontSize: '0.7rem', color: '#666' }}>Active Session</div>
          </div>
          <button className="admin-logout" onClick={onLogout} title="Logout">🚪</button>
        </div>
      </aside>
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
