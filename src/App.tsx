import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import * as api from './lib/api';
import { ApiError } from './lib/api';
import { useClock } from './hooks/useClock';
import type { PlaylistData, Page, AuthSession, Favorite, M3UItem } from './types';
import { generateMAC, qualityRank as variantPlayScore } from './utils';
import { resolveDirectUrl, resolveDirectUrls } from './lib/resolveStream';

// Pages — login lands eagerly; the rest are split per route.
import LoginScreen from './pages/client/LoginScreen';
const HomePage = lazy(() => import('./pages/client/HomePage'));
const LiveTvPage = lazy(() => import('./pages/client/LiveTvPage'));
const MovieGridPage = lazy(() => import('./pages/client/MovieGridPage'));
const SearchPage = lazy(() => import('./pages/client/SearchPage'));
const SettingsPage = lazy(() => import('./pages/client/SettingsPage'));

// Components
import RewardSessionBadge from './components/RewardSessionBadge';
import { ToastHost, toast } from './components/Toast';

// hls.js is ~150 KB gzipped — only pull it in once the user actually plays something.
const HlsPlayer = lazy(() => import('./components/HlsPlayer'));

const AUTH_KEY = 'masterplayer_auth';

interface StoredAuth {
  username: string;
  password: string;
  playlistName: string;
  userId?: string;
  sessionId?: string;
  rewardCode?: string;
  accessUntil?: string;
  coins?: number;
}

export default function App() {
  const clock = useClock();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  // Ordered fallback URLs (quality variants) for the currently-playing item —
  // the player auto-advances through these if a stream stalls or errors.
  const [playingFallbacks, setPlayingFallbacks] = useState<string[]>([]);
  // True only for the brief window between tapping "play" and the direct-link
  // resolve finishing — gives instant visual feedback since playingUrl itself
  // isn't set until resolution lands (avoids mounting the player twice).
  const [resolvingPlay, setResolvingPlay] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const deviceId = generateMAC();
  const sessionRef = useRef<AuthSession | null>(null);
  sessionRef.current = session;

  const persist = (auth: AuthSession) => {
    const toStore: StoredAuth = {
      username: auth.username,
      password: auth.password,
      playlistName: auth.playlistName,
      userId: auth.userId,
      sessionId: auth.sessionId,
      rewardCode: auth.rewardCode,
      accessUntil: auth.accessUntil,
      coins: auth.coins,
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(toStore));
  };

  const applyLoginResult = (res: api.LoginResult, base: { username: string; password: string }) => {
    const auth: AuthSession = {
      username: base.username,
      password: base.password,
      playlistName: res.playlistName || 'Krator+',
      userId: res.userId,
      sessionId: res.sessionId,
      rewardCode: res.code,
      accessUntil: res.accessUntil,
      coins: res.coins,
    };
    setSession(auth);
    persist(auth);
    setPlaylist(res.playlist);
  };

  // ── Password login ────────────────────────────────────────────────
  const doLogin = async (username: string, password: string, existingSessionId?: string): Promise<boolean> => {
    setLoginLoading(true);
    setPlaylistLoading(true);
    try {
      const res = await api.login(username.trim().toLowerCase(), password, existingSessionId);
      applyLoginResult(res, { username: username.trim().toLowerCase(), password });
      setLoginError(null);
      setCurrentPage('home');
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erro ao processar login. Tente novamente.';
      setLoginError(msg);
      return false;
    } finally {
      setLoginLoading(false);
      setPlaylistLoading(false);
    }
  };

  // ── Reward-code login ─────────────────────────────────────────────
  const doCodeLogin = async (code: string, existingSessionId?: string): Promise<boolean> => {
    setLoginLoading(true);
    setPlaylistLoading(true);
    try {
      const res = await api.redeemCode(code.trim().toUpperCase(), existingSessionId);
      applyLoginResult(res, { username: res.code || code, password: '' });
      setLoginError(null);
      setCurrentPage('home');
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível validar o código.';
      setLoginError(msg);
      return false;
    } finally {
      setLoginLoading(false);
      setPlaylistLoading(false);
    }
  };

  const logout = useCallback(async () => {
    const sid = sessionRef.current?.sessionId;
    if (sid) api.logout(sid);
    localStorage.removeItem(AUTH_KEY);
    setSession(null);
    setPlaylist(null);
    setCurrentPage('login');
  }, []);

  // On mount: restore session from localStorage, then re-validate in the background
  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (!saved) { setCurrentPage('login'); return; }

    let auth: StoredAuth;
    try {
      auth = JSON.parse(saved) as StoredAuth;
    } catch {
      localStorage.removeItem(AUTH_KEY);
      setCurrentPage('login');
      return;
    }

    setSession({
      username: auth.username,
      password: auth.password,
      playlistName: auth.playlistName,
      userId: auth.userId,
      sessionId: auth.sessionId,
      rewardCode: auth.rewardCode,
      accessUntil: auth.accessUntil,
      coins: auth.coins,
    });
    setCurrentPage('home');
    setPlaylistLoading(true);

    const revalidate = auth.rewardCode
      ? doCodeLogin(auth.rewardCode, auth.sessionId)
      : doLogin(auth.username, auth.password, auth.sessionId);

    revalidate.then(ok => { if (!ok) logout(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Favorites ─────────────────────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    if (!session) return;
    try {
      const rows = await api.getFavorites(
        session.userId ? { appUserId: session.userId } : { deviceId }
      );
      setFavorites(rows.map(r => ({
        id: r.id,
        itemName: r.itemName,
        itemType: r.itemType,
        itemGroup: r.itemGroup ?? undefined,
        itemLogo: r.itemLogo ?? undefined,
        itemUrl: r.itemUrl,
      })));
    } catch {
      console.error('Failed to fetch favorites');
    }
  }, [session, deviceId]);

  useEffect(() => {
    if (currentPage !== 'loading' && currentPage !== 'login') fetchFavorites();
  }, [currentPage, fetchFavorites]);

  const toggleFavorite = async (item: M3UItem) => {
    try {
      await api.toggleFavorite({
        appUserId: session?.userId || null,
        deviceId: session?.userId ? null : deviceId,
        itemName: item.name,
        itemType: item.type,
        itemGroup: item.group,
        itemLogo: item.logo,
        itemUrl: item.url,
      });
      fetchFavorites();
    } catch {
      toast('Não foi possível atualizar os favoritos.', 'error');
    }
  };

  // Auto-logout when a reward-code session expires (accessUntil reached)
  useEffect(() => {
    if (!session?.accessUntil) return;
    const remaining = new Date(session.accessUntil).getTime() - Date.now();
    if (remaining <= 0) { logout(); return; }
    const timer = setTimeout(() => logout(), remaining + 500);
    return () => clearTimeout(timer);
  }, [session?.accessUntil, logout]);

  // Heartbeat: keep the credential lease alive (every 60s).
  // isWatching=true when the player is open and the tab is visible.
  useEffect(() => {
    if (!session?.sessionId) return;
    const sid = session.sessionId;

    const sendHeartbeat = () => {
      api.heartbeat(sid, playingUrl !== null && !document.hidden);
    };

    const interval = setInterval(sendHeartbeat, 60 * 1000);
    const onVisibilityChange = () => sendHeartbeat();
    const onPageHide = () => api.logoutBeacon(sid);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [session?.sessionId, playingUrl]);

  const handleBack = () => setCurrentPage('home');
  const goSearch = useCallback(() => setCurrentPage('search'), []);

  // Start playback. For live channels `item.variants` holds the quality
  // variants (best-first is NOT guaranteed, so we order them worst-risk-last):
  // plain H.264 FHD/HD first, HEVC/4K last — the player falls back down this
  // list if a stream stalls.
  const handlePlay = useCallback((url: string, item?: M3UItem) => {
    const variants = item?.variants ?? [];
    // Resolve http:// links to their final CDN url first (a quick redirect
    // check, capped at 4s — see resolveStream.ts) so the player mounts once,
    // directly on the best url, instead of starting on the raw link and
    // restarting a moment later when the resolved one comes back.
    setResolvingPlay(true);
    if (variants.length > 1) {
      const ordered = [...variants].sort((a, b) => variantPlayScore(b.name) - variantPlayScore(a.name));
      const urls = ordered.map(v => v.url);
      const rest = urls.filter(u => u !== url); // requested url tried first
      const list = [url, ...rest];
      resolveDirectUrls(list).then(resolved => {
        setPlayingFallbacks(resolved);
        setPlayingUrl(resolved[0]);
        setResolvingPlay(false);
      });
    } else {
      setPlayingFallbacks([]);
      resolveDirectUrl(url).then(resolved => {
        setPlayingUrl(resolved);
        setResolvingPlay(false);
      });
    }
  }, []);

  // When the user stops watching, tell the server immediately (faster release)
  const handleStopPlaying = useCallback(() => {
    setPlayingUrl(null);
    setPlayingFallbacks([]);
    if (sessionRef.current?.sessionId) api.heartbeat(sessionRef.current.sessionId, false);
  }, []);

  const handleRefresh = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    toast('Atualizando o conteúdo...', 'info');
    setPlaylistLoading(true);
    const p = s.rewardCode
      ? doCodeLogin(s.rewardCode, s.sessionId)
      : doLogin(s.username, s.password, s.sessionId);
    p.then(ok => { if (ok) toast('Conteúdo atualizado.', 'success'); })
     .finally(() => setPlaylistLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global keyboard shortcut: '/' or Ctrl+F → open search
  useEffect(() => {
    if (!session) return;
    const handler = (e: KeyboardEvent) => {
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

  return (
    <div className="app-container">
      {playlistLoading && (
        <div className="playlist-loading-overlay">
          <div className="spinner" />
          <p>Carregando conteúdo...</p>
        </div>
      )}

      <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      {currentPage === 'login' && (
        <LoginScreen onLogin={doLogin} onLoginWithCode={doCodeLogin} error={loginError} loading={loginLoading} />
      )}

      {currentPage === 'home' && (
        <HomePage
          clock={clock}
          mac={session?.username || ''}
          playlistName={session?.playlistName || ''}
          onNavigate={setCurrentPage}
        />
      )}

      {currentPage === 'livetv' && (
        <LiveTvPage
          items={playlist?.live || []}
          onBack={handleBack}
          onPlay={handlePlay}
          onSearch={goSearch}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {currentPage === 'movies' && (
        <MovieGridPage
          title="Filmes"
          items={playlist?.movies || []}
          onBack={handleBack}
          onPlay={handlePlay}
          onSearch={goSearch}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {currentPage === 'series' && (
        <MovieGridPage
          title="Séries"
          items={playlist?.series || []}
          onBack={handleBack}
          onPlay={handlePlay}
          onSearch={goSearch}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {currentPage === 'favorites' && (
        <LiveTvPage
          title="Favoritos"
          items={favorites.map(f => ({
            name: f.itemName,
            type: f.itemType,
            group: f.itemGroup || 'Favoritos',
            logo: f.itemLogo || '',
            url: f.itemUrl,
          }))}
          onBack={handleBack}
          onPlay={handlePlay}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {currentPage === 'search' && (
        <SearchPage
          playlist={playlist}
          onBack={handleBack}
          onPlay={handlePlay}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {currentPage === 'settings' && (
        <SettingsPage
          mac={session?.username || ''}
          device={null}
          onBack={handleBack}
          onLogout={logout}
          onRefreshPlaylist={handleRefresh}
        />
      )}
      </Suspense>

      {resolvingPlay && !playingUrl && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      )}

      {playingUrl && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        }>
          <HlsPlayer url={playingUrl} fallbackUrls={playingFallbacks} onClose={handleStopPlaying} />
        </Suspense>
      )}

      {session?.rewardCode && session.accessUntil && currentPage !== 'login' && (
        <RewardSessionBadge code={session.rewardCode} accessUntil={session.accessUntil} coins={session.coins} />
      )}

      <ToastHost />
    </div>
  );
}
