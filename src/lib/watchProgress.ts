// ── Watch progress ──────────────────────────────────────────────────
// Remembers where playback stopped for each stream so movies/series can
// resume on reopen. Purely client-side (localStorage), keyed by a
// credential-stripped URL so the entry survives credential rotation.

const KEY = 'krator_watch_progress_v1';
const MAX_ENTRIES = 60;
const MIN_RESUME_SEC = 30;      // ignore the first 30s
const END_MARGIN_RATIO = 0.96;  // treat >96% watched as "finished"

export interface ProgressEntry {
  position: number;
  duration: number;
  updatedAt: number;
}

type Store = Record<string, ProgressEntry>;

export function progressKey(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    for (const p of ['username', 'user', 'password', 'pass', 'token']) u.searchParams.delete(p);
    // unwrap our own /api/proxy?url=<real>
    if (u.pathname === '/api/proxy' && u.searchParams.get('url')) {
      return progressKey(u.searchParams.get('url') as string);
    }
    return u.origin + u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    const entries = Object.entries(store);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      store = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    }
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function saveProgress(url: string, position: number, duration: number) {
  if (!isFinite(position) || !isFinite(duration) || duration <= 0) return;
  const store = read();
  const key = progressKey(url);
  if (position < MIN_RESUME_SEC || position >= duration * END_MARGIN_RATIO) {
    delete store[key]; // too early to matter, or finished
  } else {
    store[key] = { position, duration, updatedAt: Date.now() };
  }
  write(store);
}

/** Returns the seconds to resume from, or null if there is nothing useful. */
export function getResumePosition(url: string): number | null {
  const entry = read()[progressKey(url)];
  if (!entry) return null;
  if (entry.position < MIN_RESUME_SEC) return null;
  if (entry.duration > 0 && entry.position >= entry.duration * END_MARGIN_RATIO) return null;
  return entry.position;
}

export function clearProgress(url: string) {
  const store = read();
  delete store[progressKey(url)];
  write(store);
}
