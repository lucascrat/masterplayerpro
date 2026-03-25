import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

// ==========================================
// TYPES
// ==========================================

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface Device {
  id: string;
  macAddress: string;
  name: string | null;
  isActive: boolean;
  playlistId: string | null;
  playlist: Playlist | null;
  createdAt: string;
  updatedAt: string;
}

interface Playlist {
  id: string;
  name: string;
  url: string;
  type: string;
  isActive: boolean;
  adminId: string;
  createdAt: string;
  _count?: { devices: number };
}

type AdminPage = 'dashboard' | 'devices' | 'playlists';

// ==========================================
// MAIN ADMIN COMPONENT
// ==========================================

export default function Admin() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [page, setPage] = useState<AdminPage>('dashboard');

  if (!admin) {
    return <LoginPage onLogin={setAdmin} />;
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-icon">MP</div>
          <div>
            <div className="admin-logo-text">MasterPlayer</div>
            <div className="admin-logo-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="admin-nav">
          <NavItem label="Dashboard" icon="📊" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
          <NavItem label="Devices" icon="📱" active={page === 'devices'} onClick={() => setPage('devices')} />
          <NavItem label="Playlists" icon="📋" active={page === 'playlists'} onClick={() => setPage('playlists')} />
        </nav>

        <div className="admin-user-info">
          <div className="admin-avatar">{admin.name[0]}</div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{admin.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#999' }}>{admin.email}</div>
          </div>
          <button className="admin-logout" onClick={() => setAdmin(null)} title="Logout">↪</button>
        </div>
      </aside>

      <main className="admin-main">
        {page === 'dashboard' && <DashboardPage admin={admin} />}
        {page === 'devices' && <DevicesPage />}
        {page === 'playlists' && <PlaylistsPage admin={admin} />}
      </main>
    </div>
  );
}

// ==========================================
// NAV ITEM
// ==========================================

function NavItem({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <div className={`admin-nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="admin-nav-icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ==========================================
// LOGIN PAGE
// ==========================================

function LoginPage({ onLogin }: { onLogin: (admin: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLogin(data);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLogin(data);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    }
    setLoading(false);
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-logo-icon" style={{ width: 56, height: 56, fontSize: '1.2rem' }}>MP</div>
          <h1>MasterPlayer Pro</h1>
          <p>{isCreating ? 'Create Admin Account' : 'Admin Login'}</p>
        </div>

        <form onSubmit={isCreating ? handleCreate : handleLogin}>
          {isCreating && (
            <input
              className="admin-input"
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          )}
          <input
            className="admin-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="admin-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <div className="admin-error">{error}</div>}
          <button className="admin-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Loading...' : isCreating ? 'Create Account' : 'Login'}
          </button>
        </form>

        <button
          className="admin-btn-link"
          onClick={() => { setIsCreating(!isCreating); setError(''); }}
        >
          {isCreating ? 'Already have an account? Login' : 'First time? Create admin account'}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD PAGE
// ==========================================

function DashboardPage({ admin }: { admin: AdminUser }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    fetch(`${API}/admin/devices`).then(r => r.json()).then(setDevices).catch(() => {});
    fetch(`${API}/admin/playlists`).then(r => r.json()).then(setPlaylists).catch(() => {});
  }, []);

  const activeDevices = devices.filter(d => d.isActive).length;
  const inactiveDevices = devices.filter(d => !d.isActive).length;

  return (
    <div>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {admin.name}</p>
      </div>

      <div className="admin-stats-grid">
        <StatCard label="Total Devices" value={devices.length} icon="📱" color="#3b82f6" />
        <StatCard label="Active Devices" value={activeDevices} icon="✅" color="#22c55e" />
        <StatCard label="Inactive Devices" value={inactiveDevices} icon="⏳" color="#f59e0b" />
        <StatCard label="Playlists" value={playlists.length} icon="📋" color="#8b5cf6" />
      </div>

      <div className="admin-card" style={{ marginTop: '1.5rem' }}>
        <h3 className="admin-card-title">Recent Devices</h3>
        {devices.length === 0 ? (
          <p style={{ color: '#666', padding: '2rem 0', textAlign: 'center' }}>No devices registered yet</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>MAC Address</th>
                <th>Status</th>
                <th>Playlist</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, 5).map(d => (
                <tr key={d.id}>
                  <td><code className="admin-mac">{d.macAddress}</code></td>
                  <td><span className={`admin-badge ${d.isActive ? 'active' : 'inactive'}`}>{d.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>{d.playlist?.name || <span style={{ color: '#666' }}>None</span>}</td>
                  <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-icon" style={{ background: `${color}20`, color }}>{icon}</div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ==========================================
// DEVICES PAGE
// ==========================================

function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [search, setSearch] = useState('');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    fetch(`${API}/admin/devices`).then(r => r.json()).then(setDevices).catch(() => {});
    fetch(`${API}/admin/playlists`).then(r => r.json()).then(setPlaylists).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = devices.filter(d =>
    d.macAddress.toLowerCase().includes(search.toLowerCase()) ||
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.playlist?.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleActivate = async (device: Device, playlistId: string, isActive: boolean) => {
    setSaving(true);
    try {
      await fetch(`${API}/admin/device/${device.id}/activate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: playlistId || null, isActive }),
      });
      loadData();
      setEditingDevice(null);
    } catch {}
    setSaving(false);
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Devices</h1>
        <p>Manage registered devices and assign playlists</p>
      </div>

      <div className="admin-toolbar">
        <input
          className="admin-input"
          type="text"
          placeholder="Search by MAC, name or playlist..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
        <button className="admin-btn-secondary" onClick={loadData}>↻ Refresh</button>
      </div>

      <div className="admin-card">
        {filtered.length === 0 ? (
          <p style={{ color: '#666', padding: '3rem 0', textAlign: 'center' }}>
            {devices.length === 0 ? 'No devices registered yet. Devices appear here when clients open the app.' : 'No devices match your search.'}
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>MAC Address</th>
                <th>Status</th>
                <th>Playlist</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><code className="admin-mac">{d.macAddress}</code></td>
                  <td>
                    <span className={`admin-badge ${d.isActive ? 'active' : 'inactive'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{d.playlist?.name || <span style={{ color: '#666' }}>—</span>}</td>
                  <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="admin-btn-sm"
                      onClick={() => {
                        setEditingDevice(d);
                        setSelectedPlaylistId(d.playlistId || '');
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Device Modal */}
      {editingDevice && (
        <div className="admin-modal-overlay" onClick={() => setEditingDevice(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Edit Device</h2>
              <button className="admin-modal-close" onClick={() => setEditingDevice(null)}>✕</button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-field">
                <label>MAC Address</label>
                <div className="admin-mac-display">{editingDevice.macAddress}</div>
              </div>

              <div className="admin-field">
                <label>Assign Playlist</label>
                <select
                  className="admin-select"
                  value={selectedPlaylistId}
                  onChange={e => setSelectedPlaylistId(e.target.value)}
                >
                  <option value="">— No Playlist —</option>
                  {playlists.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <label>Status</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`admin-badge ${editingDevice.isActive ? 'active' : 'inactive'}`}>
                    {editingDevice.isActive ? 'Currently Active' : 'Currently Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              {editingDevice.isActive ? (
                <button
                  className="admin-btn-danger"
                  onClick={() => handleActivate(editingDevice, selectedPlaylistId, false)}
                  disabled={saving}
                >
                  Deactivate
                </button>
              ) : null}
              <div style={{ flex: 1 }} />
              <button className="admin-btn-secondary" onClick={() => setEditingDevice(null)}>Cancel</button>
              <button
                className="admin-btn-primary"
                onClick={() => handleActivate(editingDevice, selectedPlaylistId, true)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Activate & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// PLAYLISTS PAGE
// ==========================================

function PlaylistsPage({ admin }: { admin: AdminUser }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('M3U');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPlaylists = useCallback(() => {
    fetch(`${API}/admin/playlists`).then(r => r.json()).then(setPlaylists).catch(() => {});
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/admin/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, type, adminId: admin.id }),
      });
      if (!res.ok) throw new Error('Failed to create');
      setName('');
      setUrl('');
      setType('M3U');
      setShowForm(false);
      loadPlaylists();
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this playlist? Devices using it will be unlinked.')) return;
    try {
      await fetch(`${API}/admin/playlists/${id}`, { method: 'DELETE' });
      loadPlaylists();
    } catch {}
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Playlists</h1>
          <p>Manage M3U playlists to assign to devices</p>
        </div>
        <button className="admin-btn-primary" onClick={() => setShowForm(true)}>+ New Playlist</button>
      </div>

      {playlists.length === 0 && !showForm ? (
        <div className="admin-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h3 style={{ marginBottom: '0.5rem' }}>No Playlists Yet</h3>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>Create your first M3U playlist to assign to devices</p>
          <button className="admin-btn-primary" onClick={() => setShowForm(true)}>+ Create Playlist</button>
        </div>
      ) : (
        <div className="admin-playlists-grid">
          {playlists.map(p => (
            <div key={p.id} className="admin-playlist-card">
              <div className="admin-playlist-header">
                <div className="admin-playlist-icon">📋</div>
                <div style={{ flex: 1 }}>
                  <h3>{p.name}</h3>
                  <span className="admin-badge" style={{ background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf640' }}>
                    {p.type}
                  </span>
                </div>
                <button className="admin-btn-icon-danger" onClick={() => handleDelete(p.id)} title="Delete">🗑</button>
              </div>
              <div className="admin-playlist-url">{p.url}</div>
              <div className="admin-playlist-footer">
                <span>{p._count?.devices || 0} devices linked</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>New Playlist</h2>
              <button className="admin-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="admin-modal-body">
                <div className="admin-field">
                  <label>Playlist Name</label>
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="e.g. Premium List, Gold Package..."
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="admin-field">
                  <label>M3U URL</label>
                  <input
                    className="admin-input"
                    type="url"
                    placeholder="http://example.com/playlist.m3u"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="admin-field">
                  <label>Type</label>
                  <select className="admin-select" value={type} onChange={e => setType(e.target.value)}>
                    <option value="M3U">M3U</option>
                    <option value="M3U_PLUS">M3U Plus</option>
                    <option value="XTREAM">Xtream Codes</option>
                  </select>
                </div>
                {error && <div className="admin-error">{error}</div>}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
