import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { useClock } from './hooks/useClock';
import type { PlaylistData, Page, AuthSession, Favorite, M3UItem } from './types';
import { generateMAC } from './utils';

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

const AUTH_KEY = 'masterplayer_auth';
const CONTENT_PAGES: Page[] = ['livetv', 'movies', 'series', 'search', 'settings'];

export default function App() {
  const clock = useClock();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const deviceId = generateMAC();

  const doLogin = async (username: string, password: string, existingSessionId?: string): Promise<boolean> => {
    setLoginLoading(true);
    try {
      const userLower = username.trim().toLowerCase();
      
      // 1. Validar Usuário
      const { data: appUser, error: uError } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', userLower)
        .eq('password', password)
        .single();

      if (uError || !appUser) {
        setLoginError('Usuário ou senha incorretos');
        return false;
      }

      if (!appUser.is_active) {
        setLoginError('Conta desativada. Contate o administrador.');
        return false;
      }

      // 2. Buscar Playlist vinculada a este Dispositivo (MAC)
      const { data: device, error: dError } = await supabase
        .from('devices')
        .select('*, playlists(*)')
        .eq('mac_address', deviceId)
        .single();

      if (dError || !device || !device.playlists) {
        setLoginError('Dispositivo não autorizado ou sem lista vinculada.');
        return false;
      }

      if (!device.is_active) {
        setLoginError('Dispositivo bloqueado pelo administrador.');
        return false;
      }

      // 3. Gerenciamento de Sessão/Pool (Simplificado para Supabase Direto)
      let sessionId = existingSessionId;
      let credential = null;

      if (sessionId) {
        // Tentar reaproveitar lease existente
        const { data: existingLease } = await supabase
          .from('credential_leases')
          .select('*, iptv_credentials(*)')
          .eq('session_id', sessionId)
          .single();
        
        if (existingLease && existingLease.iptv_credentials) {
          credential = existingLease.iptv_credentials;
        } else {
          sessionId = undefined; // Se não existe mais, limpa para criar nova
        }
      }

      if (!sessionId) {
        // Buscar credencial disponível no pool desta playlist
        // (Buscamos credenciais ativas da playlist que não excederam max_leases)
        const { data: creds } = await supabase
          .from('iptv_credentials')
          .select('*, credential_leases(id)')
          .eq('playlist_id', device.playlists.id)
          .eq('is_active', true);

        const availableCred = creds?.find(c => (c.credential_leases?.length || 0) < c.max_leases);

        if (!availableCred) {
          setLoginError('Limite de conexões atingido para esta lista.');
          return false;
        }

        // Criar novo Lease
        const { data: newLease, error: lError } = await supabase
          .from('credential_leases')
          .insert([{
            app_user_id: appUser.id,
            credential_id: availableCred.id,
            is_watching: false
          }])
          .select()
          .single();

        if (lError || !newLease) throw new Error('Erro ao criar sessão');
        
        sessionId = newLease.session_id;
        credential = availableCred;
      }

      // 4. Montar Sessão Final
      const auth: AuthSession = { 
        username, 
        password, 
        playlistName: device.playlists.name, 
        userId: appUser.id, 
        sessionId 
      };

      // Injetar credenciais na URL da playlist para o player
      const finalPlaylist: PlaylistData = {
        ...device.playlists,
        url: device.playlists.url
          .replace('username=', `username=${credential.username}`)
          .replace('password=', `password=${credential.password}`)
      };

      setSession(auth);
      setPlaylist(finalPlaylist);
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
      setLoginError(null);
      return true;

    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError('Erro ao processar login. Tente novamente.');
      return false;
    } finally {
      setLoginLoading(false);
    }
  };

  const doCodeLogin = async (code: string, existingSessionId?: string): Promise<boolean> => {
    // Sistema de recompensas/código será migrado para Supabase em breve
    setLoginError('Sistema de códigos em manutenção.');
    return false;
  };

  const logout = async () => {
    if (session?.sessionId) {
      // Remover o lease ao deslogar
      await supabase.from('credential_leases').delete().eq('session_id', session.sessionId);
    }
    localStorage.removeItem(AUTH_KEY);
    setSession(null);
    setPlaylist(null);
    setCurrentPage('login');
  };

  // On mount: try to restore session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      try {
        const auth: AuthSession = JSON.parse(saved);
        
        // Se temos uma sessão salva, vamos para a Home IMEDIATAMENTE 
        // para evitar a tela preta de "loading". A validação acontece em paralelo.
        setSession(auth);
        setCurrentPage('home');

        if (auth.rewardCode && auth.accessUntil) {
          if (new Date(auth.accessUntil) <= new Date()) {
            logout();
            return;
          }
          doCodeLogin(auth.rewardCode, auth.sessionId);
        } else {
          // Re-validar login e carregar playlist em background
          doLogin(auth.username, auth.password, auth.sessionId).then(ok => {
            if (!ok) {
              // Se a validação falhar (ex: usuário excluído), aí sim desloga
              logout();
            }
          });
        }
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
        setCurrentPage('login');
      }
    } else {
      setCurrentPage('login');
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    if (!session && currentPage === 'login') return;
    try {
      const query = supabase.from('user_favorites').select('*');
      if (session?.userId) query.eq('app_user_id', session.userId);
      else query.eq('device_id', deviceId);

      const { data, error } = await query;
      if (error) throw error;
      setFavorites(data || []);
    } catch (err) {
      console.error('Failed to fetch favorites');
    }
  }, [session, deviceId, currentPage]);

  useEffect(() => {
    if (currentPage !== 'loading' && currentPage !== 'login') {
      fetchFavorites();
    }
  }, [currentPage, fetchFavorites]);

  const toggleFavorite = async (item: M3UItem) => {
    try {
      const isFav = favorites.find(f => f.itemName === item.name);
      
      if (isFav) {
        await supabase.from('user_favorites').delete().eq('id', isFav.id);
      } else {
        await supabase.from('user_favorites').insert([{
          app_user_id: session?.userId || null,
          device_id: session?.userId ? null : deviceId,
          itemName: item.name,
          itemType: item.type,
          itemGroup: item.group,
          itemLogo: item.logo,
          itemUrl: item.url
        }]);
      }
      fetchFavorites();
    } catch (err) {
      alert('Erro ao atualizar favoritos');
    }
  };

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

    const sendHeartbeat = async () => {
      if (session?.sessionId) {
        const isWatching = playingUrl !== null && !document.hidden;
        await supabase
          .from('credential_leases')
          .update({ 
            last_activity: new Date().toISOString(),
            is_watching: isWatching 
          })
          .eq('session_id', session.sessionId);
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
  const handleStopPlaying = useCallback(async () => {
    setPlayingUrl(null);
    if (session?.sessionId) {
      await supabase
        .from('credential_leases')
        .update({ is_watching: false })
        .eq('session_id', session.sessionId);
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
        <LiveTvPage 
          items={playlist?.live || []} 
          onBack={handleBack} 
          onPlay={setPlayingUrl} 
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
          onPlay={setPlayingUrl} 
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
          onPlay={setPlayingUrl} 
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
            url: f.itemUrl 
          }))}
          onBack={handleBack}
          onPlay={setPlayingUrl}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {currentPage === 'search' && (
        <SearchPage 
          playlist={playlist} 
          onBack={handleBack} 
          onPlay={setPlayingUrl}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
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
