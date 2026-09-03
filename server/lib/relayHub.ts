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
const REQUEST_TIMEOUT_MS = 20_000;

let agent: WebSocket | null = null;
let agentSince = 0;
const pending = new Map<string, Pending>();
let seq = 0;

export function hasRelayAgent(): boolean {
  return agent !== null && agent.readyState === WebSocket.OPEN;
}

export function relayStatus() {
  return {
    connected: hasRelayAgent(),
    since: agentSince ? new Date(agentSince).toISOString() : null,
    inflight: pending.size,
  };
}

/** Ask the connected agent to GET `url` and return the full response. */
export function relayGet(url: string, extraHeaders: Record<string, string> = {}): Promise<RelayResponse> {
  return new Promise((resolve, reject) => {
    if (!hasRelayAgent()) { reject(new Error('no relay agent connected')); return; }
    const id = `r${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('relay timeout'));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      agent!.send(JSON.stringify({ id, url, headers: extraHeaders }));
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
      // Newest agent wins; drop any previous one.
      if (agent && agent !== ws) { try { agent.close(); } catch { /* noop */ } }
      agent = ws;
      agentSince = Date.now();
      console.log('[RelayHub] agent connected');

      ws.on('message', (data) => {
        let msg: any;
        try { msg = JSON.parse(data.toString()); } catch { return; }
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
        if (agent === ws) { agent = null; agentSince = 0; }
        console.log('[RelayHub] agent disconnected');
      };
      ws.on('close', cleanup);
      ws.on('error', cleanup);

      // keep-alive ping
      const ka = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
        else clearInterval(ka);
      }, 25_000);
    });
  });

  console.log(`[RelayHub] listening for agent on ${RELAY_PATH}`);
}
