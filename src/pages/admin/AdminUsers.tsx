import { useState } from 'react';

interface AppUser {
  id: string;
  username: string;
  password: string;
  name: string | null;
  isActive: boolean;
  leases: { credential: { username: string; playlist: { name: string } } }[];
}

interface IptvCredential {
  id: string;
  username: string;
  password: string;
  maxLeases: number;
  isActive: boolean;
  playlist: { id: string; name: string };
  leases: { appUser: { id: string; username: string } }[];
}

interface Playlist {
  id: string;
  name: string;
}

interface AdminUsersProps {
  appUsers: AppUser[];
  iptvCredentials: IptvCredential[];
  playlists: Playlist[];
  onCreateUser: (data: { username: string; password: string; name?: string }) => void;
  onUpdateUser: (id: string, data: any) => void;
  onDeleteUser: (id: string) => void;
  onCreateCredential: (data: { username: string; password: string; playlistId: string; maxLeases?: number }) => void;
  onDeleteCredential: (id: string) => void;
}

export default function AdminUsers({
  appUsers, iptvCredentials, playlists,
  onCreateUser, onUpdateUser, onDeleteUser,
  onCreateCredential, onDeleteCredential,
}: AdminUsersProps) {
  const [showUserForm, setShowUserForm] = useState(false);
  const [showCredForm, setShowCredForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '' });
  const [newCred, setNewCred] = useState({ username: '', password: '', playlistId: '', maxLeases: '2' });

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.password) return;
    onCreateUser({ username: newUser.username, password: newUser.password, name: newUser.name || undefined });
    setNewUser({ username: '', password: '', name: '' });
    setShowUserForm(false);
  };

  const handleCreateCred = () => {
    if (!newCred.username || !newCred.password || !newCred.playlistId) return;
    onCreateCredential({
      username: newCred.username,
      password: newCred.password,
      playlistId: newCred.playlistId,
      maxLeases: parseInt(newCred.maxLeases) || 2,
    });
    setNewCred({ username: '', password: '', playlistId: '', maxLeases: '2' });
    setShowCredForm(false);
  };

  const totalLeases = iptvCredentials.reduce((sum, c) => sum + c.leases.length, 0);
  const totalSlots = iptvCredentials.reduce((sum, c) => sum + c.maxLeases, 0);

  return (
    <>
      {/* ── App Users Section ─────────────────────────────────── */}
      <div className="admin-page-header">
        <div>
          <h1>Usuarios do App</h1>
          <p>Cadastre usuarios que podem acessar o app com credenciais compartilhadas</p>
        </div>
        <button className="admin-btn-primary" onClick={() => setShowUserForm(!showUserForm)}>
          + Novo Usuario
        </button>
      </div>

      {showUserForm && (
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <div className="admin-card-title" style={{ marginBottom: '1rem' }}>Cadastrar Usuario</div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Usuario</label>
              <input className="admin-input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="maria" />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Senha</label>
              <input className="admin-input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="12345678" />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Nome (opcional)</label>
              <input className="admin-input" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Maria Silva" />
            </div>
            <button className="admin-btn-primary" onClick={handleCreateUser} style={{ height: 40 }}>Salvar</button>
            <button className="admin-btn-secondary" onClick={() => setShowUserForm(false)} style={{ height: 40 }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="admin-card" style={{ marginBottom: '2.5rem' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nome</th>
              <th>Senha</th>
              <th>Status</th>
              <th>Usando</th>
              <th style={{ textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {appUsers.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#555', padding: '2rem' }}>Nenhum usuario cadastrado</td></tr>
            ) : appUsers.map(u => (
              <tr key={u.id}>
                <td><span style={{ fontWeight: 600, color: '#e5e5e5' }}>{u.username}</span></td>
                <td>{u.name || <span style={{ color: '#555' }}>-</span>}</td>
                <td><span style={{ fontFamily: 'monospace', color: '#888' }}>{u.password}</span></td>
                <td>
                  <span
                    className={`admin-badge ${u.isActive ? 'active' : 'inactive'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onUpdateUser(u.id, { isActive: !u.isActive })}
                  >
                    {u.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  {u.leases.length > 0 ? (
                    <span style={{ color: '#4caf50', fontSize: '0.82rem' }}>
                      {u.leases.map(l => l.credential.playlist.name).join(', ')}
                    </span>
                  ) : (
                    <span style={{ color: '#555', fontSize: '0.82rem' }}>Offline</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="admin-btn-icon-danger" onClick={() => onDeleteUser(u.id)} title="Excluir">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── IPTV Credentials Section ──────────────────────────── */}
      <div className="admin-page-header">
        <div>
          <h1>Credenciais IPTV</h1>
          <p>Pool de credenciais compartilhadas — {totalLeases}/{totalSlots} em uso</p>
        </div>
        <button className="admin-btn-primary" onClick={() => setShowCredForm(!showCredForm)}>
          + Nova Credencial
        </button>
      </div>

      {showCredForm && (
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <div className="admin-card-title" style={{ marginBottom: '1rem' }}>Cadastrar Credencial IPTV</div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Usuario IPTV</label>
              <input className="admin-input" value={newCred.username} onChange={e => setNewCred({ ...newCred, username: e.target.value })} placeholder="335961855" />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Senha IPTV</label>
              <input className="admin-input" value={newCred.password} onChange={e => setNewCred({ ...newCred, password: e.target.value })} placeholder="188308988" />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Playlist</label>
              <select className="admin-select" value={newCred.playlistId} onChange={e => setNewCred({ ...newCred, playlistId: e.target.value })}>
                <option value="">Selecione...</option>
                {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ width: 80 }}>
              <label style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Max Usos</label>
              <input className="admin-input" type="number" min="1" max="10" value={newCred.maxLeases} onChange={e => setNewCred({ ...newCred, maxLeases: e.target.value })} />
            </div>
            <button className="admin-btn-primary" onClick={handleCreateCred} style={{ height: 40 }}>Salvar</button>
            <button className="admin-btn-secondary" onClick={() => setShowCredForm(false)} style={{ height: 40 }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario IPTV</th>
              <th>Senha IPTV</th>
              <th>Playlist</th>
              <th>Uso</th>
              <th>Usuarios Conectados</th>
              <th style={{ textAlign: 'right' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {iptvCredentials.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#555', padding: '2rem' }}>Nenhuma credencial cadastrada</td></tr>
            ) : iptvCredentials.map(c => (
              <tr key={c.id}>
                <td><span className="admin-mac">{c.username}</span></td>
                <td><span style={{ fontFamily: 'monospace', color: '#888' }}>{c.password}</span></td>
                <td>{c.playlist.name}</td>
                <td>
                  <span style={{
                    color: c.leases.length >= c.maxLeases ? '#f59e0b' : '#4caf50',
                    fontWeight: 600,
                  }}>
                    {c.leases.length}/{c.maxLeases}
                  </span>
                </td>
                <td>
                  {c.leases.length > 0 ? (
                    <span style={{ color: '#e5e5e5', fontSize: '0.82rem' }}>
                      {c.leases.map((l: any) => l.appUser.username).join(', ')}
                    </span>
                  ) : (
                    <span style={{ color: '#555', fontSize: '0.82rem' }}>Ninguem</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="admin-btn-icon-danger" onClick={() => onDeleteCredential(c.id)} title="Excluir">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
