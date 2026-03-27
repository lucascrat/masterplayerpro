import type { DeviceInfo, Page } from '../../types';
import Logo from '../../components/Logo';
import InstallBanner from '../../components/InstallBanner';

interface HomePageProps {
  clock: string;
  mac: string;
  device: DeviceInfo | null;
  onNavigate: (page: Page) => void;
}

export default function HomePage({ clock, mac, device, onNavigate }: HomePageProps) {
  const menuItems = [
    { label: 'Live TV', icon: '📺', page: 'livetv' as Page },
    { label: 'Movies', icon: '🎬', page: 'movies' as Page },
    { label: 'Series', icon: '🎭', page: 'series' as Page },
    { label: 'Replay', icon: '⏪', page: 'home' as Page },
    { label: 'Search', icon: '🔍', page: 'search' as Page },
    { label: 'Settings', icon: '⚙️', page: 'settings' as Page },
  ];

  return (
    <div className="home-screen">
      <div className="top-bar">
        <div className="time">{clock}</div>
        <div className="playlist-info">
          {device?.playlist ? (
            <>Playlist: <span>{device.playlist.name}</span></>
          ) : (
            <span style={{ color: '#999' }}>No playlist</span>
          )}
        </div>
      </div>

      <Logo size="large" />

      <div className="menu-grid">
        {menuItems.map(item => (
          <div key={item.label} className="menu-item" onClick={() => onNavigate(item.page)}>
            <div className="menu-icon">
              <span>{item.icon}</span>
            </div>
            <div className="menu-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '1.5rem', color: '#444', fontSize: '0.75rem' }}>
        {mac} | Krator+ v1.0
      </div>

      <InstallBanner />
    </div>
  );
}
