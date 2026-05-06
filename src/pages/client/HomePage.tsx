import type { DeviceInfo, Page } from '../../types';
import Logo from '../../components/Logo';
import InstallBanner from '../../components/InstallBanner';

interface HomePageProps {
  clock: string;
  mac: string;
  playlistName: string;
  onNavigate: (page: Page) => void;
}

export default function HomePage({ clock, mac, playlistName, onNavigate }: HomePageProps) {
  const menuItems = [
    { label: 'TV ao Vivo', icon: '📺', page: 'livetv' as Page },
    { label: 'Filmes', icon: '🎬', page: 'movies' as Page },
    { label: 'Séries', icon: '🎭', page: 'series' as Page },
    { label: 'Favoritos', icon: '❤️', page: 'favorites' as Page },
    { label: 'Replay', icon: '⏪', page: 'home' as Page },
    { label: 'Buscar', icon: '🔍', page: 'search' as Page },
    { label: 'Configurações', icon: '⚙️', page: 'settings' as Page },
  ];

  return (
    <div className="home-screen">
      <div className="top-bar">
        <div className="time">{clock}</div>
        <div className="playlist-info">
          {playlistName ? (
            <>Playlist: <span>{playlistName}</span></>
          ) : (
            <span style={{ color: '#999' }}>Carregando...</span>
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
        {mac} | Krator+ v1.2-debug
      </div>

      <InstallBanner />
    </div>
  );
}
