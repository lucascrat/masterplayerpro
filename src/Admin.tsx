import { useState, useEffect } from 'react';
import axios from 'axios';
import type { DeviceInfo } from './types';

// Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDevices from './pages/admin/AdminDevices';
import AdminPlaylists from './pages/admin/AdminPlaylists';

const API_BASE = '/api';

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Modal state for editing
  const [showModal, setShowModal] = useState(false);
  const [editDevice, setEditDevice] = useState<any>(null);

  const fetchAll = async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/devices`),
        axios.get(`${API_BASE}/admin/playlists`)
      ]);
      setDevices(dRes.data);
      setPlaylists(pRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data');
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchAll();
  }, [isLoggedIn]);

  const handleLogin = (pass: string) => {
    if (pass === 'master2024') {
      setIsLoggedIn(true);
      setLoginError(null);
    } else {
      setLoginError('Invalid Administrator Key');
    }
  };

  const toggleDeviceActive = async (id: string, current: boolean) => {
    try {
      await axios.patch(`${API_BASE}/admin/devices/${id}`, { isActive: !current });
      fetchAll();
    } catch (err) {
      alert('Error updating device');
    }
  };

  const deleteDevice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await axios.delete(`${API_BASE}/admin/devices/${id}`);
      fetchAll();
    } catch (err) {
      alert('Error deleting device');
    }
  };

  const saveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editDevice.id) {
        await axios.patch(`${API_BASE}/admin/devices/${editDevice.id}`, {
          macAddress: editDevice.macAddress,
          isActive: editDevice.isActive,
          playlistId: editDevice.playlistId
        });
      } else {
        await axios.post(`${API_BASE}/admin/devices`, {
          macAddress: editDevice.macAddress,
          isActive: editDevice.isActive,
          playlistId: editDevice.playlistId
        });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      alert('Error saving device');
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!confirm('Are you sure? This will affect all devices using this playlist.')) return;
    try {
      await axios.delete(`${API_BASE}/admin/playlists/${id}`);
      fetchAll();
    } catch (err) {
      alert('Error deleting playlist');
    }
  };

  const addPlaylist = async () => {
    const name = prompt('Playlist Name:');
    const url = prompt('Playlist URL (M3U):');
    if (!name || !url) return;
    try {
      await axios.post(`${API_BASE}/admin/playlists`, { name, url });
      fetchAll();
    } catch (err) {
      alert('Error adding playlist');
    }
  };

  if (!isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} error={loginError} />;
  }

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => setIsLoggedIn(false)}>
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
        <AdminPlaylists playlists={playlists} onDelete={deletePlaylist} onAdd={addPlaylist} />
      )}

      {activeTab === 'settings' && (
        <div className="admin-card">
          <div className="admin-card-title">System Settings</div>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>General platform configuration coming soon.</p>
        </div>
      )}

      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2>{editDevice.id ? 'Edit Device' : 'Add New Device'}</h2>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={saveDevice}>
              <div className="admin-modal-body">
                <div className="admin-field">
                  <label>MAC ADDRESS</label>
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
                    <option value="">No Playlist</option>
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
                    Device is Activated
                  </label>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
