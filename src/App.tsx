import { useState, useEffect } from 'react';
import axios from 'axios';
import { useClock } from './hooks/useClock';
import { generateMAC } from './utils';
import type { DeviceInfo, PlaylistData, Page } from './types';

// Pages
import MacScreen from './pages/client/MacScreen';
import HomePage from './pages/client/HomePage';
import LiveTvPage from './pages/client/LiveTvPage';
import MovieGridPage from './pages/client/MovieGridPage';
import SearchPage from './pages/client/SearchPage';
import SettingsPage from './pages/client/SettingsPage';

// Components
import HlsPlayer from './components/HlsPlayer';

const API_BASE = '/api';

export default function App() {
  const clock = useClock();
  const [mac] = useState(generateMAC);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('loading');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/device-status/${mac}`);
      setDevice(res.data.device);
      
      if (res.data.device?.isActive && res.data.playlist) {
        setPlaylist(res.data.playlist);
        if (currentPage === 'loading' || currentPage === 'mac') {
          setCurrentPage('home');
        }
      } else {
        setCurrentPage('mac');
      }
    } catch (err) {
      console.error('Fetch status error:', err);
      setError('Failed to connect to server');
      setCurrentPage('mac');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [mac]);

  const handleBack = () => setCurrentPage('home');

  if (loading && currentPage === 'loading') {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Initializing MasterPlayerPro...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {currentPage === 'mac' && (
        <MacScreen mac={mac} device={device} error={error} onRefresh={fetchStatus} />
      )}

      {currentPage === 'home' && (
        <HomePage clock={clock} mac={mac} device={device} onNavigate={setCurrentPage} />
      )}

      {currentPage === 'livetv' && (
        <LiveTvPage items={playlist?.live || []} onBack={handleBack} onPlay={setPlayingUrl} />
      )}

      {currentPage === 'movies' && (
        <MovieGridPage title="Movies" items={playlist?.movies || []} onBack={handleBack} onPlay={setPlayingUrl} />
      )}

      {currentPage === 'series' && (
        <MovieGridPage title="Series" items={playlist?.series || []} onBack={handleBack} onPlay={setPlayingUrl} />
      )}

      {currentPage === 'search' && (
        <SearchPage playlist={playlist} onBack={handleBack} onPlay={setPlayingUrl} />
      )}

      {currentPage === 'settings' && (
        <SettingsPage mac={mac} device={device} onBack={handleBack} />
      )}

      {playingUrl && (
        <HlsPlayer url={playingUrl} onClose={() => setPlayingUrl(null)} />
      )}
    </div>
  );
}
