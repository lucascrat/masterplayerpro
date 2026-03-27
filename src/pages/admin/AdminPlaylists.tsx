import { useState } from 'react';

interface Playlist {
  id: string;
  name: string;
  url: string;
  username: string | null;
  password: string | null;
  updatedAt: string;
}

interface AdminPlaylistsProps {
  playlists: Playlist[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  onUpdate?: (id: string, data: { username: string; password: string }) => void;
}

export default function AdminPlaylists({ playlists, onDelete, onAdd, onUpdate }: AdminPlaylistsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState('');
  const [editPass, setEditPass] = useState('');

  const startEdit = (p: Playlist) => {
    setEditingId(p.id);
    setEditUser(p.username || '');
    setEditPass(p.password || '');
  };

  const saveEdit = () => {
    if (editingId && onUpdate) {
      onUpdate(editingId, { username: editUser, password: editPass });
    }
    setEditingId(null);
  };

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Playlists</h1>
          <p>Gerencie playlists M3U e credenciais de acesso dos clientes</p>
        </div>
        <button className="admin-btn-primary" onClick={onAdd}>+ Adicionar Playlist</button>
      </div>

      <div className="admin-playlists-grid">
        {playlists.map(p => (
          <div key={p.id} className="admin-playlist-card">
            <div className="admin-playlist-header">
              <div className="admin-playlist-icon">📂</div>
              <div style={{ flex: 1 }}>
                <h3>{p.name}</h3>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>ID: {p.id.slice(0, 8)}...</div>
              </div>
              <button className="admin-btn-icon-danger" onClick={() => onDelete(p.id)} title="Excluir">🗑️</button>
            </div>

            <div className="admin-playlist-url">{p.url}</div>

            {/* Credentials section */}
            {editingId === p.id ? (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  value={editUser}
                  onChange={e => setEditUser(e.target.value)}
                  placeholder="Usuário"
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: '0.85rem' }}
                />
                <input
                  value={editPass}
                  onChange={e => setEditPass(e.target.value)}
                  placeholder="Senha"
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={saveEdit} style={{ flex: 1, padding: '0.45rem', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                    Salvar
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: '0.45rem', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credenciais de acesso</span>
                  <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>
                    Editar
                  </button>
                </div>
                {p.username ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#555' }}>Usuário</div>
                      <div style={{ fontSize: '0.88rem', color: '#e5e5e5', fontWeight: 600 }}>{p.username}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#555' }}>Senha</div>
                      <div style={{ fontSize: '0.88rem', color: '#e5e5e5', fontWeight: 600 }}>{p.password}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#555', fontStyle: 'italic' }}>
                    Sem credenciais — clique Editar para definir
                  </div>
                )}
              </div>
            )}

            <div className="admin-playlist-footer">
              <span>Atualizado: {new Date(p.updatedAt).toLocaleDateString('pt-BR')}</span>
              {p.username && (
                <span style={{ color: '#4caf50', fontSize: '0.75rem', fontWeight: 600 }}>Ativo</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
