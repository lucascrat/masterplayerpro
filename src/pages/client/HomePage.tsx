import type { Page } from '../../types';
import Logo from '../../components/Logo';
import InstallBanner from '../../components/InstallBanner';

interface HomePageProps {
  clock: string;
  mac: string;
  playlistName: string;
  onNavigate: (page: Page) => void;
}

const menuItems: { label: string; icon: string; page: Page }[] = [
  { label: 'TV ao Vivo', icon: '📺', page: 'livetv' },
  { label: 'Filmes', icon: '🎬', page: 'movies' },
  { label: 'Séries', icon: '🎭', page: 'series' },
  { label: 'Favoritos', icon: '❤️', page: 'favorites' },
  { label: 'Buscar', icon: '🔍', page: 'search' },
  { label: 'Configurações', icon: '⚙️', page: 'settings' },
];

export default function HomePage({ clock, mac, playlistName, onNavigate }: HomePageProps) {
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
          <div
            key={item.label}
            className="menu-item"
            role="button"
            tabIndex={0}
            onClick={() => onNavigate(item.page)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(item.page); } }}
          >
            <div className="menu-icon">
              <span>{item.icon}</span>
            </div>
            <div className="menu-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '1.5rem', color: '#444', fontSize: '0.75rem' }}>
        {mac} · Krator+
      </div>

      <InstallBanner />
    </div>
  );
}
