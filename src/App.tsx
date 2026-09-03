// Build Trigger: Cloudflare Pages Deployment - v1.1.2-stable
import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { supabase } from './lib/supabase';
import { useClock } from './hooks/useClock';
import type { PlaylistData, Page, AuthSession, Favorite, M3UItem } from './types';
import { generateMAC, parseM3UFromUrl } from './utils';

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

export default function App() {
  const clock = useClock();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const deviceId = generateMAC();

  // Busca e parseia o arquivo M3U da URL fornecida
  const loadPlaylist = useCallback(async (url: string) => {
    console.log('--- INICIANDO CARREGAMENTO DE PLAYLIST ---');
    console.log('URL Base:', url.split('?')[0]);
    setPlaylistLoading(true);
    try {
      const items = await parseM3UFromUrl(url);
      console.log(`Sucesso: ${items.length} itens encontrados.`);
      
      if (items.length === 0) {
        console.warn('Aviso: Nenhum item extraído da lista.');
        throw new Error('O arquivo M3U foi lido mas não contém nenhum canal ou filme. Verifique se as credenciais da lista estão corretas.');
      }

      const live = items.filter(i => i.type === 'live');
      const movies = items.filter(i => i.type === 'movie');
      const series = items.filter(i => i.type === 'series');

      console.log('Resumo da Categorização:');
      console.log(`- Canais: ${live.length}`);
      console.log(`- Filmes: ${movies.length}`);
      console.log(`- Séries: ${series.length}`);

      if (live.length === 0 && movies.length === 0 && series.length === 0) {
        console.warn('Aviso: Todos os itens foram filtrados (nenhum tipo correspondente).');
        throw new Error('A lista foi lida mas nenhum item pôde ser categorizado como TV, Filme ou Série.');
      }

      setPlaylist({ live, movies, series });
      console.log('--- PLAYLIST DEFINIDA NO ESTADO COM SUCESSO ---');
    } catch (err: any) {
      console.error('ERRO NO CARREGAMENTO:', err);
      toast(err.message || 'Erro desconhecido ao processar a lista M3U.', 'error', 7000);
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  const doLogin = async (username: string, password: string, existingSessionId?: string): Promise<boolean> => {
    setLoginLoading(true);
    try {
      const userLower = username.trim().toLowerCase();

      // 1. Validar Usuário
      const { data: appUser, error: uError } = await supabase
        .from('app_users')
        .select('id, username, is_active')
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

      // 2. Reutilizar sessão existente (restauração de sessão)
      let sessionId = existingSessionId;
      let credential: any = null;
      let playlistUrl = '';
      let playlistName = '';

      if (sessionId) {
        const { data: existingLease } = await supabase
          .from('credential_leases')
          .select('session_id, iptv_credentials(*, playlists(*))')
          .eq('session_id', sessionId)
          .single();

        if (existingLease?.iptv_credentials) {
          credential = existingLease.iptv_credentials;
          
          const playlistObj = Array.isArray((credential as any).playlists)
            ? (credential as any).playlists[0]
            : (credential as any).playlists;

          playlistUrl = playlistObj?.url || '';
          playlistName = playlistObj?.name || '';
          console.log('Sessão restaurada. Playlist:', playlistName, 'URL:', playlistUrl ? 'OK' : 'Vazia');
        } else {
          sessionId = undefined; // Sessão expirou, criar nova
        }
      }

      if (!sessionId) {
        // 3. Limpar leases expirados (ociosos há mais de 10 min)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase
          .from('credential_leases')
          .delete()
          .lt('last_activity', tenMinutesAgo)
          .eq('is_watching', false);

        // 4. Buscar credencial disponível do pool global
        const { data: creds, error: cError } = await supabase
          .from('iptv_credentials')
          .select('*, playlists(*), credential_leases(id)')
          .eq('is_active', true);

        if (cError) throw cError;

        const availableCred = (creds as any[])?.find(
          c => (c.credential_leases?.length || 0) < (c.max_leases || 2)
        );

        if (!availableCred) {
          setLoginError('Serviço lotado no momento. Tente novamente em alguns minutos.');
          return false;
        }

        // 5. Criar Lease (reservar credencial para este usuário)
        const { data: newLease, error: lError } = await supabase
          .from('credential_leases')
          .insert([{
            app_user_id: appUser.id,
            credential_id: availableCred.id,
            is_watching: false
          }])
          .select('session_id')
          .single();

        if (lError || !newLease) throw new Error('Erro ao reservar credencial');

        sessionId = (newLease as any).session_id;
        credential = availableCred;
        
        // Suporte robusto para relação Supabase (pode vir como objeto ou array de 1 item)
        const playlistObj = Array.isArray((availableCred as any).playlists) 
          ? (availableCred as any).playlists[0] 
          : (availableCred as any).playlists;

        playlistUrl = playlistObj?.url || '';
        playlistName = playlistObj?.name || '';
        
        console.log('Nova sessão. Playlist:', playlistName, 'URL:', playlistUrl ? 'OK' : 'Vazia');

        if (!playlistUrl) {
          throw new Error('A credencial selecionada não possui uma playlist vinculada.');
        }
      }

      // 6. Montar sessão e injetar credenciais na URL
      const auth: AuthSession = {
        username: appUser.username,
        password,
        playlistName,
        userId: appUser.id,
        sessionId
      };

      // Construção robusta da URL com URL API
      let finalUrl = playlistUrl;
      try {
        const urlObj = new URL(playlistUrl);
        
        // Remove parâmetros antigos se existirem (para evitar duplicatas)
        urlObj.searchParams.delete('username');
        urlObj.searchParams.delete('user');
        urlObj.searchParams.delete('password');
        urlObj.searchParams.delete('pass');

        // Adiciona as credenciais da conta IPTV
        urlObj.searchParams.set('username', credential.username);
        urlObj.searchParams.set('password', credential.password);
        
        finalUrl = urlObj.toString();
      } catch (e) {
        // Fallback para replace simples se a URL for inválida para o construtor
        finalUrl = playlistUrl
          .replace(/(username|user)=[^&]*/i, `$1=${credential.username}`)
          .replace(/(password|pass)=[^&]*/i, `$1=${credential.password}`);
      }

      setSession(auth);
      // Salvar URL para poder recarregar depois
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...auth, _playlistUrl: finalUrl }));
      setLoginError(null);
      setCurrentPage('home');

      // Carregar conteúdo da playlist em background
      loadPlaylist(finalUrl);
      return true;

    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError('Erro ao processar login. Tente novamente.');
      return false;
    } finally {
      setLoginLoading(false);
    }
  };


  const doCodeLogin = async (_code: string): Promise<boolean> => {
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
        const stored = JSON.parse(saved);
        const { _playlistUrl, ...auth } = stored;

        // Vai para Home imediatamente, sem tela de loading
        setSession(auth as AuthSession);
        setCurrentPage('home');

        // Recarregar playlist salva em paralelo
        if (_playlistUrl) {
          loadPlaylist(_playlistUrl);
        }

        // Re-validar sessão em background (sem bloquear a UI)
        doLogin(auth.username, auth.password, auth.sessionId).then(ok => {
          if (!ok) logout();
        });

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
      toast('Não foi possível atualizar os favoritos.', 'error');
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
        // Use Supabase REST directly via sendBeacon (fire-and-forget on unload)
        supabase
          .from('credential_leases')
          .delete()
          .eq('session_id', session.sessionId)
          .then(() => {});
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

  const handleRefresh = useCallback(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      const stored = JSON.parse(saved);
      if (stored._playlistUrl) {
        toast('Atualizando o conteúdo...', 'info');
        loadPlaylist(stored._playlistUrl);
      }
    }
  }, [loadPlaylist]);

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
    const totalItems = (playlist?.live?.length || 0) + (playlist?.movies?.length || 0) + (playlist?.series?.length || 0);
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Carregando playlist...</p>
        {totalItems > 0 && <p style={{ fontSize: '0.9rem', color: '#4caf50' }}>{totalItems} itens processados</p>}
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          Aguarde, isso pode levar alguns segundos
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {playlistLoading && (
        <div className="playlist-loading-overlay">
          <div className="spinner" />
          <p>Atualizando conteúdo...</p>
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
        <SettingsPage
          mac={session?.username || ''}
          device={null}
          onBack={handleBack}
          onLogout={logout}
          onRefreshPlaylist={handleRefresh}
        />
      )}
      </Suspense>

      {playingUrl && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        }>
          <HlsPlayer url={playingUrl} onClose={handleStopPlaying} />
        </Suspense>
      )}

      {session?.rewardCode && session.accessUntil && currentPage !== 'login' && (
        <RewardSessionBadge code={session.rewardCode} accessUntil={session.accessUntil} coins={session.coins} />
      )}

      <ToastHost />
    </div>
  );
}
