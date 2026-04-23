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
import RewardSessionBadge from './components/RewardSessionBadge';

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

  const doLogin = async (username: string, password: string, existingSessionId?: string): Promise<boolean> => {
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { username, password, sessionId: existingSessionId }, { timeout: 45000 });
      const auth: AuthSession = { username, password, playlistName: res.data.playlistName, userId: res.data.userId, sessionId: res.data.sessionId };
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

  const doCodeLogin = async (code: string, existingSessionId?: string): Promise<boolean> => {
    try {
      const res = await axios.post(`${API_BASE}/auth/redeem-code`, { code, sessionId: existingSessionId }, { timeout: 45000 });
      const auth: AuthSession = {
        username: `code:${res.data.code}`,
        password: '',
        playlistName: res.data.playlistName,
        userId: res.data.userId,
        sessionId: res.data.sessionId,
        rewardCode: res.data.code,
        accessUntil: res.data.accessUntil,
        coins: res.data.coins,
      };
      setSession(auth);
      setPlaylist(res.data.playlist);
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      setLoginError(null);
      return true;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao validar código. Tente novamente.';
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

  const handleLoginWithCode = async (code: string) => {
    setLoginLoading(true);
    setLoginError(null);
    const ok = await doCodeLogin(code);
    setLoginLoading(false);
    if (ok) setCurrentPage('home');
  };

  const logout = () => {
    // Release this device's session on explicit logout
    if (session?.sessionId) {
      navigator.sendBeacon(`${API_BASE}/auth/logout`, JSON.stringify({ sessionId: session.sessionId }));
    }
    localStorage.removeItem(AUTH_KEY);
    setSession(null);
    setPlaylist(null);
    setCurrentPage('login');
  };

  // On mount: try to restore session from localStorage
  // Passes saved sessionId so the server reuses the existing session (no new screen)
  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      const auth: AuthSession = JSON.parse(saved);
      // Rewards code session — skip restore if time already expired
      if (auth.rewardCode && auth.accessUntil) {
        if (new Date(auth.accessUntil) <= new Date()) {
          localStorage.removeItem(AUTH_KEY);
          setCurrentPage('login');
          return;
        }
        doCodeLogin(auth.rewardCode, auth.sessionId).then(ok => {
          setCurrentPage(ok ? 'home' : 'login');
        });
        return;
      }
      doLogin(auth.username, auth.password, auth.sessionId).then(ok => {
        setCurrentPage(ok ? 'home' : 'login');
      });
    } else {
      setCurrentPage('login');
    }
  }, []);

  // Auto-logout when a reward-code session expires (accessUntil reached)
  useEffect(() => {
    if (!session?.accessUntil) return;
    const remaining = new Date(session.accessUntil).getTime() - Date.now();
    if (remaining <= 0) {
      logout();
      return;
    }
    const timer = setTimeout(() => logout(), remaining + 500);
    return () => clearTimeout(timer);
  }, [session?.accessUntil]);

  // Heartbeat: keep credential lease alive (every 60s) + refresh playlist (every 5min)
  // Sends isWatching=true when player is open, false when idle.
  // Server uses different timeouts: 5min for watching, 2min for idle.
  useEffect(() => {
    if (!session) return;

    const sendHeartbeat = () => {
      if (session?.sessionId) {
        const isWatching = playingUrl !== null && !document.hidden;
        axios.post(`${API_BASE}/auth/heartbeat`, { sessionId: session.sessionId, isWatching }, { timeout: 10000 }).catch(() => {});
      }
    };

    // Heartbeat every 60s
    const heartbeatInterval = setInterval(sendHeartbeat, 60 * 1000);

    // When tab becomes hidden/visible, send heartbeat immediately to update status
    const onVisibilityChange = () => {
      sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Release this device's session when user closes/navigates away
    const onBeforeUnload = () => {
      if (session?.sessionId) {
        navigator.sendBeacon(
          `${API_BASE}/auth/logout`,
          new Blob([JSON.stringify({ sessionId: session.sessionId })], { type: 'application/json' })
        );
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [session, playingUrl]);

  const handleBack = () => setCurrentPage('home');
  const goSearch = useCallback(() => setCurrentPage('search'), []);

  // When user stops watching, immediately tell server (faster credential release)
  const handleStopPlaying = useCallback(() => {
    setPlayingUrl(null);
    if (session?.sessionId) {
      axios.post(`${API_BASE}/auth/heartbeat`, { sessionId: session.sessionId, isWatching: false }, { timeout: 10000 }).catch(() => {});
    }
  }, [session]);

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
        <LoginScreen onLogin={handleLogin} onLoginWithCode={handleLoginWithCode} error={loginError} loading={loginLoading} />
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
        <HlsPlayer url={playingUrl} onClose={handleStopPlaying} />
      )}

      {session?.rewardCode && session.accessUntil && currentPage !== 'login' && (
        <RewardSessionBadge code={session.rewardCode} accessUntil={session.accessUntil} coins={session.coins} />
      )}
    </div>
  );
}
