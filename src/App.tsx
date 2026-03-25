import { useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';

const API_URL = import.meta.env.DEV ? 'http://localhost:3001/api' : '/api';

// ==========================================
// TYPES
// ==========================================

interface M3UItem {
  name: string;
  logo: string;
  group: string;
  url: string;
  type: 'live' | 'movie' | 'series';
}

interface PlaylistData {
  live: M3UItem[];
  movies: M3UItem[];
  series: M3UItem[];
}

interface DeviceInfo {
  id: string;
  macAddress: string;
  isActive: boolean;
  playlist: { name: string; url: string; } | null;
}

type Page = 'loading' | 'mac' | 'home' | 'livetv' | 'movies' | 'series' | 'search' | 'settings';

// ==========================================
// MAC ADDRESS GENERATOR
// ==========================================

function generateMAC(): string {
  const stored = localStorage.getItem('masterplayer_mac');
  if (stored) return stored;

  const hex = '0123456789ABCDEF';
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
  }
  const mac = parts.join(':');
  localStorage.setItem('masterplayer_mac', mac);
  return mac;
}

// ==========================================
// HELPER: Group items by group name
// ==========================================

function groupByCategory(items: M3UItem[]): Record<string, M3UItem[]> {
  const groups: Record<string, M3UItem[]> = {};
  items.forEach(item => {
    const g = item.group || 'Uncategorized';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  });
  return groups;
}

// ==========================================
// POSTER IMAGE WITH FALLBACK
// ==========================================

function PosterImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <span className="placeholder">🎬</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
    />
  );
}

// ==========================================
// HLS PLAYER COMPONENT
// ==========================================

function HlsPlayer({ url, onClose }: { url: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#000', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        controls
        autoPlay
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.7)',
          color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
          padding: '8px 16px', fontSize: '1rem', cursor: 'pointer', zIndex: 10000,
        }}
      >
        ✕ Close
      </button>
    </div>
  );
}

// ==========================================
// CLOCK COMPONENT
// ==========================================

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ==========================================
// MAIN APP
// ==========================================

export default function App() {
  const [page, setPage] = useState<Page>('loading');
  const [mac, setMac] = useState('');
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clock = useClock();

  // Initialize: generate MAC and register
  useEffect(() => {
    const init = async () => {
      const macAddr = generateMAC();
      setMac(macAddr);

      try {
        // Register device
        const regRes = await fetch(`${API_URL}/device/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ macAddress: macAddr }),
        });
        await regRes.json();

        // Get full device info
        const devRes = await fetch(`${API_URL}/device/${macAddr}`);
        const fullDevice = await devRes.json();
        setDevice(fullDevice);

        if (fullDevice.isActive && fullDevice.playlist) {
          // Load playlist
          const plRes = await fetch(`${API_URL}/playlist/${macAddr}`);
          if (plRes.ok) {
            const plData = await plRes.json();
            setPlaylist(plData);
            setPage('home');
          } else {
            setPage('mac');
          }
        } else {
          setPage('mac');
        }
      } catch {
        // API offline - show MAC screen
        setPage('mac');
        setError('Server offline - showing MAC for activation');
      }
    };

    init();
  }, []);

  const refreshPlaylist = useCallback(async () => {
    try {
      const plRes = await fetch(`${API_URL}/playlist/${mac}`);
      if (plRes.ok) {
        const plData = await plRes.json();
        setPlaylist(plData);
        setPage('home');
        setError(null);
      }
    } catch {
      setError('Could not connect to server');
    }
  }, [mac]);

  // Player overlay
  if (playing) {
    return <HlsPlayer url={playing} onClose={() => setPlaying(null)} />;
  }

  // Loading
  if (page === 'loading') {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: '#999' }}>Connecting...</p>
      </div>
    );
  }

  // MAC Screen (not activated)
  if (page === 'mac') {
    return (
      <div className="mac-screen">
        <div className="logo-container">
          <div className="logo-icon" />
          <div className="logo-text">
            MASTER<span className="highlight">PLAYER</span>
          </div>
        </div>
        <div className="mac-display">
          <h2>Your Device MAC Address</h2>
          <div className="mac-address">{mac}</div>
        </div>
        <div className={`mac-status ${device?.isActive ? 'active' : 'inactive'}`}>
          {device?.isActive ? '● Activated' : '● Waiting for Activation'}
        </div>
        <p className="mac-info">
          Send this MAC address to your provider to activate your subscription and link a playlist.
        </p>
        <button
          onClick={refreshPlaylist}
          style={{
            background: 'linear-gradient(135deg, #e63946, #b71c2c)',
            color: '#fff',
            border: 'none',
            padding: '0.8rem 2rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Refresh Status
        </button>
        {error && <p style={{ color: '#e63946', fontSize: '0.85rem' }}>{error}</p>}
      </div>
    );
  }

  // Home Screen
  if (page === 'home') {
    return <HomeScreen clock={clock} mac={mac} device={device} onNavigate={setPage} />;
  }

  // Content pages
  if (page === 'livetv') {
    return <ContentListPage title="Live TV" items={playlist?.live || []} onBack={() => setPage('home')} onPlay={setPlaying} />;
  }

  if (page === 'movies') {
    return <MovieGridPage title="Movies" items={playlist?.movies || []} onBack={() => setPage('home')} onPlay={setPlaying} />;
  }

  if (page === 'series') {
    return <MovieGridPage title="Series" items={playlist?.series || []} onBack={() => setPage('home')} onPlay={setPlaying} />;
  }

  if (page === 'search') {
    return <SearchPage playlist={playlist} onBack={() => setPage('home')} onPlay={setPlaying} />;
  }

  if (page === 'settings') {
    return <SettingsPage mac={mac} device={device} onBack={() => setPage('home')} />;
  }

  return null;
}

// ==========================================
// HOME SCREEN COMPONENT
// ==========================================

function HomeScreen({ clock, mac, device, onNavigate }: {
  clock: string;
  mac: string;
  device: DeviceInfo | null;
  onNavigate: (page: Page) => void;
}) {
  const menuItems = [
    { label: 'Live TV', icon: '📺', page: 'livetv' as Page },
    { label: 'Movies', icon: '🎬', page: 'movies' as Page },
    { label: 'Series', icon: '🎭', page: 'series' as Page },
    { label: 'Replay', icon: '⏪', page: 'home' as Page },
    { label: 'Search', icon: '🔍', page: 'search' as Page },
    { label: 'Settings', icon: '⚙️', page: 'settings' as Page },
  ];

  return (
    <div className="home-screen">
      <div className="top-bar">
        <div className="time">{clock}</div>
        <div className="playlist-info">
          {device?.playlist ? (
            <>Playlist: <span>{device.playlist.name}</span></>
          ) : (
            <span style={{ color: '#999' }}>No playlist</span>
          )}
        </div>
      </div>

      <div className="logo-container">
        <div className="logo-icon" />
        <div className="logo-text">
          MASTER<span className="highlight">PLAYER</span>
        </div>
      </div>

      <div className="menu-grid">
        {menuItems.map(item => (
          <div key={item.label} className="menu-item" onClick={() => onNavigate(item.page)}>
            <div className="menu-icon">
              <span>{item.icon}</span>
            </div>
            <div className="menu-label">{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '1.5rem', color: '#444', fontSize: '0.75rem' }}>
        MAC: {mac} | MasterPlayer Pro v1.0
      </div>
    </div>
  );
}

// ==========================================
// CONTENT LIST PAGE (Live TV style)
// ==========================================

function ContentListPage({ title, items, onBack, onPlay }: {
  title: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
}) {
  const groups = groupByCategory(items);
  const categories = Object.keys(groups);
  const [selectedCat, setSelectedCat] = useState(categories[0] || '');

  const currentItems = groups[selectedCat] || [];

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>{title}</h1>
        <span className="count">{items.length} channels</span>
      </div>
      <div className="content-layout">
        <div className="category-sidebar">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item ${selectedCat === cat ? 'active' : ''}`}
              onClick={() => setSelectedCat(cat)}
            >
              <span>{cat}</span>
              <span className="count">{groups[cat].length}</span>
            </div>
          ))}
        </div>
        <div className="channel-list">
          {currentItems.length === 0 ? (
            <div className="empty-state">
              <span>📺</span>
              <span>No channels available</span>
            </div>
          ) : (
            currentItems.map((item, idx) => (
              <div key={idx} className="channel-item" onClick={() => onPlay(item.url)}>
                <div className="channel-logo">
                  {item.logo ? (
                    <img src={item.logo} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  ) : (
                    <span className="placeholder">📺</span>
                  )}
                </div>
                <div className="channel-info">
                  <div className="channel-name">{item.name}</div>
                  <div className="channel-group">{item.group}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MOVIE GRID PAGE
// ==========================================

function MovieGridPage({ title, items, onBack, onPlay }: {
  title: string;
  items: M3UItem[];
  onBack: () => void;
  onPlay: (url: string) => void;
}) {
  const groups = groupByCategory(items);
  const categories = Object.keys(groups);
  const [selectedCat, setSelectedCat] = useState(categories[0] || '');
  const [visibleCount, setVisibleCount] = useState(50);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reset selection when items change (e.g. navigating back and forth)
  useEffect(() => {
    const cats = Object.keys(groupByCategory(items));
    if (cats.length > 0 && !cats.includes(selectedCat)) {
      setSelectedCat(cats[0]);
    }
  }, [items]);

  // Reset visible count when category changes
  const handleCatSelect = (cat: string) => {
    setSelectedCat(cat);
    setVisibleCount(50);
    gridRef.current?.scrollTo(0, 0);
  };

  const currentItems = groups[selectedCat] || [];
  const displayedItems = currentItems.slice(0, visibleCount);
  const hasMore = visibleCount < currentItems.length;

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>{title}</h1>
        <span className="count">{items.length} items</span>
      </div>
      <div className="content-layout">
        <div className="category-sidebar">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-item ${selectedCat === cat ? 'active' : ''}`}
              onClick={() => handleCatSelect(cat)}
            >
              <span>{cat}</span>
              <span className="count">{groups[cat].length}</span>
            </div>
          ))}
        </div>
        <div className="movie-grid" ref={gridRef}>
          {displayedItems.length === 0 ? (
            <div className="empty-state">
              <span>🎬</span>
              <span>No content available</span>
            </div>
          ) : (
            <>
              {displayedItems.map((item, idx) => (
                <div key={idx} className="movie-card" onClick={() => onPlay(item.url)}>
                  <div className="movie-poster">
                    {item.logo ? (
                      <PosterImage src={item.logo} alt={item.name} />
                    ) : (
                      <span className="placeholder">🎬</span>
                    )}
                  </div>
                  <div className="movie-title">{item.name}</div>
                </div>
              ))}
              {hasMore && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem' }}>
                  <button
                    onClick={() => setVisibleCount(v => v + 50)}
                    style={{
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '10px 24px', fontSize: '0.9rem',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Load More ({currentItems.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SEARCH PAGE
// ==========================================

function SearchPage({ playlist, onBack, onPlay }: {
  playlist: PlaylistData | null;
  onBack: () => void;
  onPlay: (url: string) => void;
}) {
  const [query, setQuery] = useState('');

  const allItems = [
    ...(playlist?.live || []),
    ...(playlist?.movies || []),
    ...(playlist?.series || []),
  ];

  const filtered = query.length >= 2
    ? allItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Search</h1>
      </div>
      <div style={{ padding: '1.5rem' }}>
        <input
          className="search-input"
          type="text"
          placeholder="Search channels, movies, series..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <div style={{ marginTop: '1rem' }}>
          {filtered.length > 0 ? (
            filtered.slice(0, 50).map((item, idx) => (
              <div key={idx} className="channel-item" onClick={() => onPlay(item.url)}>
                <div className="channel-logo">
                  {item.logo ? (
                    <img src={item.logo} alt={item.name} loading="lazy" referrerPolicy="no-referrer" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  ) : (
                    <span className="placeholder">{item.type === 'live' ? '📺' : '🎬'}</span>
                  )}
                </div>
                <div className="channel-info">
                  <div className="channel-name">{item.name}</div>
                  <div className="channel-group">{item.group} • {item.type.toUpperCase()}</div>
                </div>
              </div>
            ))
          ) : query.length >= 2 ? (
            <div className="empty-state" style={{ height: '40vh' }}>
              <span>🔍</span>
              <span>No results for "{query}"</span>
            </div>
          ) : (
            <div className="empty-state" style={{ height: '40vh' }}>
              <span>🔍</span>
              <span>Type at least 2 characters to search</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SETTINGS PAGE
// ==========================================

function SettingsPage({ mac, device, onBack }: {
  mac: string;
  device: DeviceInfo | null;
  onBack: () => void;
}) {
  return (
    <div className="content-page">
      <div className="content-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h1>Settings</h1>
      </div>
      <div className="settings-page">
        <div className="settings-section">
          <h3>Device Information</h3>
          <div className="settings-row">
            <span className="label">MAC Address</span>
            <span className="value" style={{ fontFamily: 'monospace', color: '#ffd700' }}>{mac}</span>
          </div>
          <div className="settings-row">
            <span className="label">Status</span>
            <span className="value" style={{ color: device?.isActive ? '#4caf50' : '#e63946' }}>
              {device?.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="settings-row">
            <span className="label">Device ID</span>
            <span className="value">{device?.id || 'N/A'}</span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Playlist</h3>
          <div className="settings-row">
            <span className="label">Name</span>
            <span className="value">{device?.playlist?.name || 'None'}</span>
          </div>
          <div className="settings-row">
            <span className="label">URL</span>
            <span className="value" style={{ fontSize: '0.8rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {device?.playlist?.url || 'None'}
            </span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Application</h3>
          <div className="settings-row">
            <span className="label">App Version</span>
            <span className="value">MasterPlayer Pro v1.0</span>
          </div>
          <div className="settings-row">
            <span className="label">Player</span>
            <span className="value">HTML5 Video</span>
          </div>
        </div>
      </div>
    </div>
  );
}
