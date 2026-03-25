interface AdminPlaylistsProps {
  playlists: any[];
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function AdminPlaylists({ playlists, onDelete, onAdd }: AdminPlaylistsProps) {
  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Playlists</h1>
          <p>Global M3U playlists shared across devices</p>
        </div>
        <button className="admin-btn-primary" onClick={onAdd}>+ Add Playlist</button>
      </div>

      <div className="admin-playlists-grid">
        {playlists.map(p => (
          <div key={p.id} className="admin-playlist-card">
            <div className="admin-playlist-header">
              <div className="admin-playlist-icon">📂</div>
              <div style={{ flex: 1 }}>
                <h3>{p.name}</h3>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>ID: {p.id}</div>
              </div>
              <button className="admin-btn-icon-danger" onClick={() => onDelete(p.id)} title="Delete">🗑️</button>
            </div>
            <div className="admin-playlist-url">{p.url}</div>
            <div className="admin-playlist-footer">
              <span>Updated: {new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
