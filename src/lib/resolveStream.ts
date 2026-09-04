// Some IPTV links (movie/live) are themselves just a redirect to the real CDN.
// `/api/resolve` follows that hop server-side (a few bytes, not the video) and
// hands back the final URL. When that final URL is https://, the browser can
// play it straight from the provider's CDN — zero bandwidth through our own
// server. When it's still http:// (the CDN itself has no TLS, common for live
// channels), there's nothing to gain: return the original url unchanged and
// let HlsPlayer's existing native/proxy fallback chain handle it as before.

let cache = new Map<string, Promise<string>>();

async function resolveOne(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return url;
    const data = await res.json();
    if (data?.secure && typeof data.resolvedUrl === 'string') return data.resolvedUrl;
  } catch {
    // Network hiccup / resolve endpoint unreachable — fall back silently,
    // the player's own native/direct/proxy chain still works from here.
  }
  return url;
}

/** Resolve one http:// link to its final https:// CDN url, if any. Cached per URL. */
export function resolveDirectUrl(url: string): Promise<string> {
  if (!url.startsWith('http://')) return Promise.resolve(url);
  let p = cache.get(url);
  if (!p) {
    p = resolveOne(url);
    cache.set(url, p);
  }
  return p;
}

/** Resolve a whole list in parallel, preserving order. */
export function resolveDirectUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map(resolveDirectUrl));
}
