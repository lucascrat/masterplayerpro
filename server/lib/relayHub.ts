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
// a few MB and home upstream is the slow leg. Kept tight because relayGet
// retries on a second agent: 2 x 8s still fits inside the player's budget.
const REQUEST_TIMEOUT_MS = 8_000;

// Multiple agents may connect at once (the same PC started twice, or a spare
// box). We keep them all, but a socket can go half-open — the window is gone
// yet readyState is still OPEN — and blind round-robin then drops every other
// request into a black hole. So each agent carries health, we prefer the
// healthiest, and a request that times out retries on a different agent.
interface AgentInfo { ws: WebSocket; lastSeen: number; fails: number; }
const agents = new Map<WebSocket, AgentInfo>();
let firstAgentAt = 0;
const pending = new Map<string, Pending>();
let seq = 0;

const DEAD_AFTER_FAILS = 2;

function liveAgents(): AgentInfo[] {
  return [...agents.values()].filter(a => a.ws.readyState === WebSocket.OPEN);
}

/** Healthiest first: fewest consecutive failures, then most recently active. */
function rankedAgents(): AgentInfo[] {
  return liveAgents().sort((a, b) => a.fails - b.fails || b.lastSeen - a.lastSeen);
}

export function hasRelayAgent(): boolean {
  return liveAgents().length > 0;
}

export function relayStatus() {
  const live = liveAgents();
  return {
    connected: live.length > 0,
    agents: live.length,
    health: live.map(a => ({ fails: a.fails, idleMs: Date.now() - a.lastSeen })),
    since: firstAgentAt ? new Date(firstAgentAt).toISOString() : null,
    inflight: pending.size,
  };
}

function dropAgent(a: AgentInfo, why: string) {
  console.warn(`[RelayHub] dropping unhealthy agent (${why})`);
  agents.delete(a.ws);
  try { a.ws.terminate(); } catch { /* noop */ }
}

/** Send one request to a specific agent. */
function sendTo(a: AgentInfo, url: string, extraHeaders: Record<string, string>): Promise<RelayResponse> {
  return new Promise((resolve, reject) => {
    const id = `r${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      a.fails++;
      if (a.fails >= DEAD_AFTER_FAILS) dropAgent(a, `${a.fails} timeouts`);
      reject(new Error('relay timeout'));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, {
      resolve: (v) => { a.fails = 0; resolve(v); },
      reject,
      timer,
    });
    try {
      a.ws.send(JSON.stringify({ id, url, headers: extraHeaders }));
    } catch (e: any) {
      clearTimeout(timer);
      pending.delete(id);
      dropAgent(a, 'send failed');
      reject(new Error('relay send failed: ' + e.message));
    }
  });
}

/** Ask a connected agent to GET `url`; retries once on a different agent. */
export async function relayGet(url: string, extraHeaders: Record<string, string> = {}): Promise<RelayResponse> {
  const ranked = rankedAgents();
  if (ranked.length === 0) throw new Error('no relay agent connected');
  let lastErr: any;
  // Try the healthiest, then one alternate — enough to route around a zombie.
  for (const a of ranked.slice(0, 2)) {
    try {
      return await sendTo(a, url, extraHeaders);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
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
      const info: AgentInfo = { ws, lastSeen: Date.now(), fails: 0 };
      agents.set(ws, info);
      if (!firstAgentAt) firstAgentAt = Date.now();
      console.log(`[RelayHub] agent connected (${liveAgents().length} total)`);

      ws.on('message', (data) => {
        info.lastSeen = Date.now();
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
      ws.on('pong', () => { info.lastSeen = Date.now(); });

      // Application-level keepalive: data frames traverse proxies that drop
      // WS control frames. A socket that stops answering is half-open — cut it
      // fast so requests aren't routed into a black hole.
      const ka = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) { clearInterval(ka); return; }
        if (Date.now() - info.lastSeen > 25_000) {
          console.warn('[RelayHub] agent silent >25s, terminating');
          agents.delete(ws);
          try { ws.terminate(); } catch { /* noop */ }
          return;
        }
        try { ws.send(JSON.stringify({ type: 'ping' })); ws.ping(); } catch { /* noop */ }
      }, 8_000);
    });
  });

  console.log(`[RelayHub] listening for agent on ${RELAY_PATH}`);
}
