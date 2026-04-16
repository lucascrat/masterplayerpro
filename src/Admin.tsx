import { useState, useEffect } from 'react';
import axios from 'axios';
import type { DeviceInfo } from './types';

// Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDevices from './pages/admin/AdminDevices';
import AdminPlaylists from './pages/admin/AdminPlaylists';
import AdminUsers from './pages/admin/AdminUsers';

const API_BASE = '/api';
const ADMIN_SESSION_KEY = 'masterplayer_admin';

// Axios instance with admin auth header
const adminApi = axios.create({ baseURL: API_BASE });

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
    if (saved === 'master2024') {
      adminApi.defaults.headers.common['authorization'] = 'master2024';
      setIsLoggedIn(true);
    }
  }, []);

  const fetchAll = async () => {
    try {
      const [dRes, pRes, uRes, cRes] = await Promise.all([
        adminApi.get('/admin/devices'),
        adminApi.get('/admin/playlists'),
        adminApi.get('/admin/app-users'),
        adminApi.get('/admin/iptv-credentials'),
      ]);
      setDevices(dRes.data);
      setPlaylists(pRes.data);
      setAppUsers(uRes.data);
      setIptvCredentials(cRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data');
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchAll();
  }, [isLoggedIn]);

  const handleLogin = (pass: string) => {
    if (pass === 'master2024') {
      adminApi.defaults.headers.common['authorization'] = 'master2024';
      localStorage.setItem(ADMIN_SESSION_KEY, 'master2024');
      setIsLoggedIn(true);
      setLoginError(null);
    } else {
      setLoginError('Chave de administrador inválida');
    }
  };

  const toggleDeviceActive = async (id: string, current: boolean) => {
    try {
      await adminApi.patch(`/admin/devices/${id}`, { isActive: !current });
      fetchAll();
    } catch (err) {
      alert('Erro ao atualizar dispositivo');
    }
  };

  const deleteDevice = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este dispositivo?')) return;
    try {
      await adminApi.delete(`/admin/devices/${id}`);
      fetchAll();
    } catch (err) {
      alert('Erro ao excluir dispositivo');
    }
  };

  const saveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editDevice.id) {
        await adminApi.patch(`/admin/devices/${editDevice.id}`, {
          macAddress: editDevice.macAddress,
          isActive: editDevice.isActive,
          playlistId: editDevice.playlistId
        });
      } else {
        await adminApi.post(`/admin/devices`, {
          macAddress: editDevice.macAddress,
          isActive: editDevice.isActive,
          playlistId: editDevice.playlistId
        });
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
      await adminApi.delete(`/admin/playlists/${id}`);
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
      await adminApi.post(`/admin/playlists`, { name, url });
      fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro desconhecido';
      alert(`Erro ao adicionar playlist: ${msg}`);
    }
  };

  const updatePlaylist = async (id: string, data: { username: string; password: string }) => {
    try {
      await adminApi.patch(`/admin/playlists/${id}`, data);
      fetchAll();
    } catch (err) {
      alert('Erro ao atualizar credenciais da playlist');
    }
  };

  // App Users CRUD
  const createAppUser = async (data: { username: string; password: string; name?: string }) => {
    try {
      await adminApi.post('/admin/app-users', data);
      fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar usuário');
    }
  };

  const updateAppUser = async (id: string, data: any) => {
    try {
      await adminApi.patch(`/admin/app-users/${id}`, data);
      fetchAll();
    } catch (err) {
      alert('Erro ao atualizar usuário');
    }
  };

  const deleteAppUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await adminApi.delete(`/admin/app-users/${id}`);
      fetchAll();
    } catch (err) {
      alert('Erro ao excluir usuário');
    }
  };

  // IPTV Credentials CRUD
  const createIptvCredential = async (data: { username: string; password: string; playlistId: string; maxLeases?: number }) => {
    try {
      await adminApi.post('/admin/iptv-credentials', data);
      fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Erro ao criar credencial');
    }
  };

  const deleteIptvCredential = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta credencial?')) return;
    try {
      await adminApi.delete(`/admin/iptv-credentials/${id}`);
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
