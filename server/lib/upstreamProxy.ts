// Optional outbound proxy for upstream IPTV requests.
//
// Some IPTV providers block datacenter/VPS IP ranges (403 "Access denied")
// or geo-restrict streams. Set UPSTREAM_PROXY_URL to route every upstream
// fetch (stream proxy + playlist fetch) through a residential/allowed proxy.
//
//   UPSTREAM_PROXY_URL=http://user:pass@proxy-host:port
//
// Accepts http:// or https:// proxy URLs. When unset, requests go direct
// (current behaviour, zero overhead).

import type { AxiosProxyConfig } from 'axios';

let cached: AxiosProxyConfig | false | undefined;

/**
 * Returns an axios `proxy` config parsed from UPSTREAM_PROXY_URL, or `false`
 * (axios's "no proxy, ignore env") when not configured. Result is memoised.
 */
export function upstreamProxy(): AxiosProxyConfig | false {
  if (cached !== undefined) return cached;

  const raw = (process.env.UPSTREAM_PROXY_URL || '').trim();
  if (!raw) { cached = false; return cached; }

  try {
    const u = new URL(raw);
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
    console.log(`[UpstreamProxy] Routing upstream requests via ${cfg.protocol}://${cfg.host}:${cfg.port}`);
    cached = cfg;
  } catch (err: any) {
    console.error(`[UpstreamProxy] Invalid UPSTREAM_PROXY_URL, ignoring: ${err.message}`);
    cached = false;
  }
  return cached;
}
