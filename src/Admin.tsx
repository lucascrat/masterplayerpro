import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { DeviceInfo } from './types';

// Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDevices from './pages/admin/AdminDevices';
import AdminPlaylists from './pages/admin/AdminPlaylists';
import AdminUsers from './pages/admin/AdminUsers';

const ADMIN_SESSION_KEY = 'masterplayer_admin';
const DEFAULT_ADMIN_ID = '4a5e54c2-8954-438b-9e9d-4daad9674807';

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [iptvCredentials, setIptvCredentials] = useState<any[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Modal state for editing
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState<any>(null);

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_SESSION_KEY);
    if (saved === 'active') {
      setIsLoggedIn(true);
    }
  }, []);

  const fetchAll = async () => {
    try {
      // Fetch data from Supabase (masterplayer schema is default in src/lib/supabase.ts)
      const [
        { data: dData },
        { data: pData },
        { data: uData },
        { data: cData }
      ] = await Promise.all([
        supabase.from('devices').select('*, playlists(*)').order('created_at', { ascending: false }),
        supabase.from('playlists').select('*').order('created_at', { ascending: false }),
        supabase.from('app_users').select('*, credential_leases(*, iptv_credentials(*, playlists(*)))').order('created_at', { ascending: false }),
        supabase.from('iptv_credentials').select('*, playlists(*), credential_leases(*, app_users(*))').order('created_at', { ascending: false }),
      ]);

      // Map snake_case to camelCase and handle relations
      setDevices((dData || []).map((d: any) => ({
        id: d.id,
        macAddress: d.mac_address,
        name: d.name,
        isActive: d.is_active,
        playlistId: d.playlist_id,
        playlist: d.playlists ? { id: d.playlists.id, name: d.playlists.name } : null,
        createdAt: d.created_at
      })));

      setPlaylists((pData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        username: p.username,
        password: p.password,
        type: p.type,
        isActive: p.is_active,
        createdAt: p.created_at
      })));

      setAppUsers((uData || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        password: u.password,
        name: u.name,
        isActive: u.is_active,
        createdAt: u.created_at,
        leases: (u.credential_leases || []).map((l: any) => ({
          credential: {
            username: l.iptv_credentials?.username,
            playlist: { name: l.iptv_credentials?.playlists?.name || 'Sem Nome' }
          }
        }))
      })));

      setIptvCredentials((cData || []).map((c: any) => ({
        id: c.id,
        username: c.username,
        password: c.password,
        playlistId: c.playlist_id,
        playlist: c.playlists ? { id: c.playlists.id, name: c.playlists.name } : { id: '', name: 'Sem Playlist' },
        maxLeases: c.max_leases,
        isActive: c.is_active,
        createdAt: c.created_at,
        leases: (c.credential_leases || []).map((l: any) => ({
          appUser: { id: l.app_users?.id, username: l.app_users?.username }
        }))
      })));

    } catch (err) {
      console.error('Failed to fetch admin data from Supabase:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchAll();
  }, [isLoggedIn]);

  const handleLogin = async (user: string, pass: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', user)
        .eq('password', pass)
        .single();

      if (error || !data) {
        setLoginError('Usuário ou senha inválidos');
        return;
      }

      localStorage.setItem(ADMIN_SESSION_KEY, 'active');
      setIsLoggedIn(true);
      setLoginError(null);
    } catch (err) {
      setLoginError('Erro ao conectar com o banco de dados');
    }
  };

  const toggleDeviceActive = async (id: string, current: boolean) => {
    try {
      await supabase.from('devices').update({ is_active: !current }).eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao atualizar dispositivo');
    }
  };

  const deleteDevice = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este dispositivo?')) return;
    try {
      await supabase.from('devices').delete().eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao excluir dispositivo');
    }
  };

  const saveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        mac_address: editDevice.macAddress,
        is_active: editDevice.isActive,
        playlist_id: editDevice.playlistId || null
      };

      if (editDevice.id) {
        await supabase.from('devices').update(payload).eq('id', editDevice.id);
      } else {
        await supabase.from('devices').insert([payload]);
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      alert('Erro ao salvar dispositivo');
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm('Tem certeza? Isso afetará todos os dispositivos que usam esta playlist.')) return;
    try {
      await supabase.from('playlists').delete().eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao excluir playlist');
    }
  };

  const addPlaylist = async () => {
    const name = prompt('Nome da Playlist:');
    const url = prompt('URL da Playlist (M3U):');
    if (!name || !url) return;
    try {
      const { error } = await supabase.from('playlists').insert([{
        name,
        url,
        admin_id: DEFAULT_ADMIN_ID,
        type: 'M3U',
        is_active: true
      }]);
      if (error) throw error;
      fetchAll();
    } catch (err: any) {
      alert(`Erro ao adicionar playlist: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const updatePlaylist = async (id: string, data: { username: string; password: string }) => {
    try {
      await supabase.from('playlists').update(data).eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao atualizar credenciais da playlist');
    }
  };

  // App Users CRUD
  const createAppUser = async (data: { username: string; password: string; name?: string }) => {
    try {
      const { error } = await supabase.from('app_users').insert([{
        username: data.username.trim().toLowerCase(),
        password: data.password,
        name: data.name,
        is_active: true
      }]);
      if (error) throw error;
      fetchAll();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar usuário');
    }
  };

  const updateAppUser = async (id: string, data: any) => {
    try {
      const payload: any = {};
      if (data.username !== undefined) payload.username = data.username.trim().toLowerCase();
      if (data.password !== undefined) payload.password = data.password;
      if (data.name !== undefined) payload.name = data.name;
      if (data.isActive !== undefined) payload.is_active = data.isActive;

      await supabase.from('app_users').update(payload).eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao atualizar usuário');
    }
  };

  const deleteAppUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await supabase.from('app_users').delete().eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao excluir usuário');
    }
  };

  // IPTV Credentials CRUD
  const createIptvCredential = async (data: { username: string; password: string; playlistId?: string; maxLeases?: number }) => {
    try {
      const { error } = await supabase.from('iptv_credentials').insert([{
        username: data.username,
        password: data.password,
        playlist_id: data.playlistId,
        max_leases: data.maxLeases || 2,
        is_active: true
      }]);
      if (error) throw error;
      fetchAll();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar credencial');
    }
  };

  const deleteIptvCredential = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta credencial?')) return;
    try {
      await supabase.from('iptv_credentials').delete().eq('id', id);
      fetchAll();
    } catch (err) {
      alert('Erro ao excluir credencial');
    }
  };

  if (!isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} error={loginError} />;
  }

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => { localStorage.removeItem(ADMIN_SESSION_KEY); setIsLoggedIn(false); }}>
      {activeTab === 'dashboard' && (
        <AdminDashboard devices={devices} playlists={playlists} />
      )}

      {activeTab === 'devices' && (
        <AdminDevices 
          devices={devices} 
          playlists={playlists} 
          onToggleActive={toggleDeviceActive} 
          onDelete={deleteDevice}
          onOpenEdit={(d) => { setEditDevice(d); setShowModal(true); }}
        />
      )}

      {activeTab === 'playlists' && (
        <AdminPlaylists playlists={playlists} onDelete={deletePlaylist} onAdd={addPlaylist} onUpdate={updatePlaylist} />
      )}

      {activeTab === 'users' && (
        <AdminUsers
          appUsers={appUsers}
          iptvCredentials={iptvCredentials}
          playlists={playlists}
          onCreateUser={createAppUser}
          onUpdateUser={updateAppUser}
          onDeleteUser={deleteAppUser}
          onCreateCredential={createIptvCredential}
          onDeleteCredential={deleteIptvCredential}
        />
      )}

      {activeTab === 'settings' && (
        <div className="admin-card">
          <div className="admin-card-title">Configurações do Sistema</div>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Configurações gerais da plataforma em breve.</p>
        </div>
      )}

      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2>{editDevice.id ? 'Editar Dispositivo' : 'Adicionar Dispositivo'}</h2>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={saveDevice}>
              <div className="admin-modal-body">
                <div className="admin-field">
                  <label>ENDEREÇO MAC</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={editDevice.macAddress}
                    onChange={e => setEditDevice({ ...editDevice, macAddress: e.target.value })}
                    placeholder="00:00:00:00:00:00"
                    required
                  />
                </div>
                <div className="admin-field">
                  <label>PLAYLIST</label>
                  <select
                    className="admin-select"
                    value={editDevice.playlistId || ''}
                    onChange={e => setEditDevice({ ...editDevice, playlistId: e.target.value })}
                  >
                    <option value="">Sem Playlist</option>
                    {playlists.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none' }}>
                    <input
                      type="checkbox"
                      checked={editDevice.isActive}
                      onChange={e => setEditDevice({ ...editDevice, isActive: e.target.checked })}
                    />
                    Dispositivo Ativado
                  </label>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="admin-btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
