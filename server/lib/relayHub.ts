// Reverse relay hub.
//
// The IPTV provider 403s our datacenter IP on live `.m3u8` manifest requests
// (Cloudflare bot rules). Instead of an outbound proxy, a small agent on a
// residential machine dials IN over WebSocket; the server hands it the tiny
// manifest URLs to fetch from that residential IP and stream the text back.
//
// Only small text responses go over this channel (manifests, a few KB).
// Video segments and the big playlist are NOT relayed.
//
//   RELAY_KEY   shared secret the agent must present (?key=...)
//
// If no agent is connected, callers fall back to their normal path.

import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface Pending {
  resolve: (v: RelayResponse) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export interface RelayResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

const RELAY_PATH = '/api/relay/agent';
// Covers: agent fetches from CDN + uploads the body back to us. Segments are
// a few MB and home upstream is the slow leg, so allow generous headroom.
const REQUEST_TIMEOUT_MS = 15_000;

// Multiple agents may connect at once (e.g. the same PC started twice, or a
// spare box). We keep them ALL and round-robin — fighting over a single slot
// caused a reconnect storm.
const agents = new Set<WebSocket>();
let firstAgentAt = 0;
let rr = 0;
const pending = new Map<string, Pending>();
let seq = 0;

function liveAgents(): WebSocket[] {
  return [...agents].filter(w => w.readyState === WebSocket.OPEN);
}

export function hasRelayAgent(): boolean {
  return liveAgents().length > 0;
}

export function relayStatus() {
  return {
    connected: hasRelayAgent(),
    agents: liveAgents().length,
    since: firstAgentAt ? new Date(firstAgentAt).toISOString() : null,
    inflight: pending.size,
  };
}

/** Ask a connected agent to GET `url` and return the full response. */
export function relayGet(url: string, extraHeaders: Record<string, string> = {}): Promise<RelayResponse> {
  return new Promise((resolve, reject) => {
    const live = liveAgents();
    if (live.length === 0) { reject(new Error('no relay agent connected')); return; }
    const ws = live[rr++ % live.length];
    const id = `r${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('relay timeout'));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      ws.send(JSON.stringify({ id, url, headers: extraHeaders }));
    } catch (e: any) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error('relay send failed: ' + e.message));
    }
  });
}

export function attachRelayHub(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try { pathname = new URL(req.url || '', 'http://x').pathname; } catch { /* noop */ }
    if (pathname !== RELAY_PATH) return; // let other upgrade handlers (if any) deal with it

    const key = (() => {
      try { return new URL(req.url || '', 'http://x').searchParams.get('key') || ''; } catch { return ''; }
    })();
    const expected = process.env.RELAY_KEY || '';
    if (!expected || key !== expected) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      agents.add(ws);
      if (!firstAgentAt) firstAgentAt = Date.now();
      let lastSeen = Date.now();
      console.log(`[RelayHub] agent connected (${liveAgents().length} total)`);

      ws.on('message', (data) => {
        lastSeen = Date.now();
        let msg: any;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg?.type === 'pong' || msg?.type === 'ping') return; // liveness only
        const p = msg?.id ? pending.get(msg.id) : undefined;
        if (!p) return;
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) {
          p.reject(new Error('relay agent error: ' + msg.error));
          return;
        }
        p.resolve({
          status: Number(msg.status) || 0,
          headers: msg.headers || {},
          body: Buffer.from(msg.bodyB64 || '', 'base64'),
        });
      });

      const cleanup = () => {
        clearInterval(ka);
        agents.delete(ws);
        if (agents.size === 0) firstAgentAt = 0;
        console.log(`[RelayHub] agent disconnected (${liveAgents().length} left)`);
      };
      ws.on('close', cleanup);
      ws.on('error', cleanup);
      ws.on('pong', () => { lastSeen = Date.now(); });

      // Application-level keepalive: data frames traverse proxies that drop
      // WS control frames. Terminate a silent connection so the agent can
      // reconnect cleanly instead of us sending requests into a dead socket.
      const ka = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) { clearInterval(ka); return; }
        if (Date.now() - lastSeen > 45_000) {
          console.warn('[RelayHub] agent silent >45s, terminating');
          try { ws.terminate(); } catch { /* noop */ }
          return;
        }
        try { ws.send(JSON.stringify({ type: 'ping' })); ws.ping(); } catch { /* noop */ }
      }, 15_000);
    });
  });

  console.log(`[RelayHub] listening for agent on ${RELAY_PATH}`);
}
