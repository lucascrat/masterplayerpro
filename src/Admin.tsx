import { useState, useEffect, useCallback } from 'react';
import * as api from './lib/api';
import { ApiError } from './lib/api';
import { toast } from './components/Toast';
import type { DeviceInfo } from './types';

// Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDevices from './pages/admin/AdminDevices';
import AdminPlaylists from './pages/admin/AdminPlaylists';
import AdminUsers from './pages/admin/AdminUsers';

const ADMIN_KEY_STORAGE = 'masterplayer_admin_key';

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [iptvCredentials, setIptvCredentials] = useState<any[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Modal state for editing devices
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState<any>(null);

  // Restore session on mount — validate the stored key against the API
  useEffect(() => {
    const savedKey = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (!savedKey) return;
    api.setAdminKey(savedKey);
    api.admin.verify()
      .then(() => setIsLoggedIn(true))
      .catch(() => localStorage.removeItem(ADMIN_KEY_STORAGE));
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [d, p, u, c] = await Promise.all([
        api.admin.getDevices(),
        api.admin.getPlaylists(),
        api.admin.getAppUsers(),
        api.admin.getIptvCredentials(),
      ]);
      setDevices(d as DeviceInfo[]);
      setPlaylists(p);
      setAppUsers(u);
      setIptvCredentials(c);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      toast('Falha ao carregar dados do servidor.', 'error');
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchAll();
  }, [isLoggedIn, fetchAll]);

  // AdminLogin passes (username, password) — we treat the password field as the
  // admin key. Username is cosmetic.
  const handleLogin = async (_user: string, key: string) => {
    try {
      api.setAdminKey(key);
      await api.admin.verify();
      localStorage.setItem(ADMIN_KEY_STORAGE, key);
      setIsLoggedIn(true);
      setLoginError(null);
    } catch (err) {
      api.setAdminKey('');
      setLoginError(err instanceof ApiError && err.status === 401 ? 'Chave de acesso inválida' : 'Erro ao conectar com o servidor');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    api.setAdminKey('');
    setIsLoggedIn(false);
  };

  const guard = async (fn: () => Promise<unknown>, errMsg: string, okMsg?: string) => {
    try {
      await fn();
      await fetchAll();
      if (okMsg) toast(okMsg, 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : errMsg, 'error');
    }
  };

  // ── Devices ─────────────────────────────────────────────────────
  const toggleDeviceActive = (id: string, current: boolean) =>
    guard(() => api.admin.updateDevice(id, { isActive: !current }), 'Erro ao atualizar dispositivo');

  const deleteDevice = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este dispositivo?')) return;
    guard(() => api.admin.deleteDevice(id), 'Erro ao excluir dispositivo');
  };

  const saveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      macAddress: editDevice.macAddress,
      isActive: !!editDevice.isActive,
      playlistId: editDevice.playlistId || null,
    };
    const op = editDevice.id
      ? () => api.admin.updateDevice(editDevice.id, payload)
      : () => api.admin.createDevice(payload);
    guard(op, 'Erro ao salvar dispositivo').then(() => setShowModal(false));
  };

  // ── Playlists ───────────────────────────────────────────────────
  const deletePlaylist = (id: string) => {
    if (!confirm('Tem certeza? Isso apagará também as credenciais IPTV vinculadas a esta lista.')) return;
    guard(() => api.admin.deletePlaylist(id), 'Erro ao excluir playlist', 'Playlist removida.');
  };

  const addPlaylist = () => {
    const name = prompt('Nome da Playlist:');
    if (!name) return;
    const url = prompt('URL da Playlist (M3U):');
    if (!url) return;
    guard(
      () => api.admin.createPlaylist({ name, url }),
      'Erro ao adicionar playlist',
      'Playlist adicionada. Credenciais extraídas da URL quando possível.',
    );
  };

  const updatePlaylist = (id: string, data: { username: string; password: string }) =>
    guard(() => api.admin.updatePlaylist(id, data), 'Erro ao atualizar credenciais da playlist');

  // ── App users ───────────────────────────────────────────────────
  const createAppUser = (data: { username: string; password: string; name?: string }) =>
    guard(() => api.admin.createAppUser(data), 'Erro ao criar usuário', 'Usuário criado.');

  const updateAppUser = (id: string, data: any) =>
    guard(() => api.admin.updateAppUser(id, data), 'Erro ao atualizar usuário');

  const deleteAppUser = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    guard(() => api.admin.deleteAppUser(id), 'Erro ao excluir usuário');
  };

  // ── IPTV credentials ────────────────────────────────────────────
  const createIptvCredential = (data: { username: string; password: string; playlistId?: string; serverUrl?: string; maxLeases?: number }) =>
    guard(() => api.admin.createIptvCredential(data), 'Erro ao criar credencial', 'Credencial criada.');

  const deleteIptvCredential = (id: string) => {
    if (!confirm('Tem certeza? Todos os usuários usando esta credencial serão desconectados.')) return;
    guard(() => api.admin.deleteIptvCredential(id), 'Erro ao excluir credencial', 'Credencial removida.');
  };

  const testIptvCredential = (data: { username: string; password: string; playlistId: string }) =>
    api.admin.testIptvCredential(data);

  if (!isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} error={loginError} />;
  }

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout}>
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
          onTestCredential={testIptvCredential}
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
                      checked={!!editDevice.isActive}
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
