// Tiny runtime config fetched once from the server (see GET /api/config).
// Lets ops turn the HTTP-only watch page on/off via a Coolify env var
// (HTTP_WATCH_ORIGIN) without a client rebuild.

interface RuntimeConfig {
  httpWatchOrigin: string | null;
}

let cached: Promise<RuntimeConfig> | null = null;

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cached) {
    cached = fetch('/api/config')
      .then(r => (r.ok ? r.json() : { httpWatchOrigin: null }))
      .catch(() => ({ httpWatchOrigin: null }));
  }
  return cached;
}
