// Optional outbound proxy for upstream IPTV requests.
//
// Some IPTV providers sit behind Cloudflare and 403 ("Access denied") any
// datacenter/VPS IP. Routing the small manifest / auth requests through a
// residential-looking proxy dodges that. The heavy video segments (a
// different CDN host) don't need it, so scope the proxy to the provider
// host only and keep bandwidth off the proxy.
//
//   UPSTREAM_PROXY_URL    comma-separated proxy URLs, tried in order, e.g.
//                         http://user:pass@host1:port,http://host2:port
//   UPSTREAM_PROXY_HOSTS  comma-separated host substrings the proxy applies
//                         to (e.g. "qtiv410.top"). Empty = apply to all.
//
// Callers get an ordered candidate list that ALWAYS ends with `false`
// (direct, no proxy) so a dead proxy degrades instead of hard-failing.

import type { AxiosProxyConfig } from 'axios';

let parsed: AxiosProxyConfig[] | undefined;
let hostFilter: string[] | undefined;

function parseOne(raw: string): AxiosProxyConfig | null {
  try {
    const u = new URL(raw.trim());
    const cfg: AxiosProxyConfig = {
      host: u.hostname,
      port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80),
      protocol: u.protocol.replace(':', ''),
    };
    if (u.username || u.password) {
      cfg.auth = {
        username: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
      };
    }
    return cfg;
  } catch (err: any) {
    console.error(`[UpstreamProxy] Bad proxy URL "${raw}": ${err.message}`);
    return null;
  }
}

function proxies(): AxiosProxyConfig[] {
  if (parsed !== undefined) return parsed;
  const raw = (process.env.UPSTREAM_PROXY_URL || '').trim();
  parsed = raw
    ? raw.split(',').map(s => s.trim()).filter(Boolean).map(parseOne).filter((c): c is AxiosProxyConfig => !!c)
    : [];
  if (parsed.length) {
    console.log(`[UpstreamProxy] ${parsed.length} proxy(ies) configured: ${parsed.map(p => `${p.host}:${p.port}`).join(', ')}`);
  }
  return parsed;
}

function hosts(): string[] {
  if (hostFilter !== undefined) return hostFilter;
  hostFilter = (process.env.UPSTREAM_PROXY_HOSTS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return hostFilter;
}

/** Does the proxy apply to this target URL? (host-scope check) */
export function proxyAppliesTo(targetUrl: string): boolean {
  if (proxies().length === 0) return false;
  const filter = hosts();
  if (filter.length === 0) return true;
  let host = '';
  try { host = new URL(targetUrl).hostname.toLowerCase(); } catch { return false; }
  return filter.some(h => host === h || host.endsWith('.' + h) || host.includes(h));
}

/**
 * Ordered proxy candidates to try for `targetUrl`. Each is an axios `proxy`
 * value. The list ALWAYS ends with `false` (direct) as the last resort, so
 * every caller should just iterate until one succeeds.
 */
export function proxyCandidates(targetUrl: string): (AxiosProxyConfig | false)[] {
  if (!proxyAppliesTo(targetUrl)) return [false];
  return [...proxies(), false];
}
