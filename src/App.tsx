import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useClock } from './hooks/useClock';
import type { PlaylistData, Page, AuthSession } from './types';

// Pages
import LoginScreen from './pages/client/LoginScreen';
import HomePage from './pages/client/HomePage';
import LiveTvPage from './pages/client/LiveTvPage';
import MovieGridPage from './pages/client/MovieGridPage';
import SearchPage from './pages/client/SearchPage';
import SettingsPage from './pages/client/SettingsPage';

// Components
import HlsPlayer from './components/HlsPlayer';

const API_BASE = '/api';
const AUTH_KEY = 'masterplayer_auth';
const CONTENT_PAGES: Page[] = ['livetv', 'movies', 'series', 'search', 'settings'];

export default function App() {
  const clock = useClock();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('loading');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const doLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { username, password }, { timeout: 45000 });
      const auth: AuthSession = { username, password, playlistName: res.data.playlistName };
      setSession(auth);
      setPlaylist(res.data.playlist);
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      setLoginError(null);
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao conectar. Tente novamente.';
      setLoginError(msg);
      return false;
    }
  };

  const handleLogin = async (username: string, password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    const ok = await doLogin(username, password);
    setLoginLoading(false);
    if (ok) setCurrentPage('home');
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setSession(null);
    setPlaylist(null);
    setCurrentPage('login');
  };

  // On mount: try to restore session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      const auth: AuthSession = JSON.parse(saved);
      doLogin(auth.username, auth.password).then(ok => {
        setCurrentPage(ok ? 'home' : 'login');
      });
    } else {
      setCurrentPage('login');
    }
  }, []);

  // Refresh playlist every 5 minutes if logged in
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      if (session) {
        try {
          const res = await axios.post(`${API_BASE}/auth/login`, { username: session.username, password: session.password }, { timeout: 25000 });
          setPlaylist(res.data.playlist);
        } catch {
          // Silently ignore refresh errors — don't kick user from content pages
        }
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleBack = () => setCurrentPage('home');
  const goSearch = useCallback(() => setCurrentPage('search'), []);

  // Global keyboard shortcut: '/' or Ctrl+F → open search
  useEffect(() => {
    if (!session) return;
    const handler = (e: KeyboardEvent) => {
      // Don't hijack when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '/' || (e.ctrlKey && e.key === 'f')) {
        e.preventDefault();
        setCurrentPage('search');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session]);

  // Loading screen
  if (currentPage === 'loading') {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Carregando playlist...</p>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          Aguarde, isso pode levar alguns segundos
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {currentPage === 'login' && (
        <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />
      )}

      {currentPage === 'home' && (
        <HomePage clock={clock} mac={session?.username || ''} device={null} onNavigate={setCurrentPage} />
      )}

      {currentPage === 'livetv' && (
        <LiveTvPage items={playlist?.live || []} onBack={handleBack} onPlay={setPlayingUrl} onSearch={goSearch} />
      )}

      {currentPage === 'movies' && (
        <MovieGridPage title="Filmes" items={playlist?.movies || []} onBack={handleBack} onPlay={setPlayingUrl} onSearch={goSearch} />
      )}

      {currentPage === 'series' && (
        <MovieGridPage title="Séries" items={playlist?.series || []} onBack={handleBack} onPlay={setPlayingUrl} onSearch={goSearch} />
      )}

      {currentPage === 'search' && (
        <SearchPage playlist={playlist} onBack={handleBack} onPlay={setPlayingUrl} />
      )}

      {currentPage === 'settings' && (
        <SettingsPage mac={session?.username || ''} device={null} onBack={handleBack} onLogout={logout} />
      )}

      {playingUrl && (
        <HlsPlayer url={playingUrl} onClose={() => setPlayingUrl(null)} />
      )}
    </div>
  );
}
