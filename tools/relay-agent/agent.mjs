// Krator+ residential relay agent.
//
// Runs on an always-on machine with a residential IP. Dials IN to the Krator+
// server over WebSocket and fetches the small `.m3u8` manifest URLs the server
// hands it, from THIS machine's IP — bypassing the datacenter 403 the IPTV
// provider returns to the server directly.
//
// Only tiny text responses (manifests, a few KB) pass through here. Video and
// the big playlist never touch this machine.
//
// Requirements: Node.js 21+ (uses built-in WebSocket + fetch). Node 22 OK.
//
// Config via env vars (or edit the defaults below):
//   KRATOR_HUB  wss URL of the server relay endpoint
//   KRATOR_KEY  shared secret (must match the server's RELAY_KEY)

const HUB = process.env.KRATOR_HUB || 'wss://krator.appbr.pro/api/relay/agent';
const KEY = process.env.KRATOR_KEY || 'PASTE_RELAY_KEY_HERE';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15_000;
// Manifests are KB; live .ts segments run a few MB. Cap well above a segment.
const MAX_BODY_BYTES = 16 * 1024 * 1024;

let backoff = 500;

function ts() { return new Date().toISOString().slice(11, 19); }
function log(...a) { console.log(`[${ts()}]`, ...a); }

function connect() {
  const url = `${HUB}?key=${encodeURIComponent(KEY)}`;
  log('connecting to', HUB);
  const ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    backoff = 500;
    log('connected — waiting for requests');
  });

  ws.addEventListener('message', async (ev) => {
    let req;
    try { req = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); }
    catch { return; }
    if (req && req.type === 'ping') { try { ws.send(JSON.stringify({ type: 'pong' })); } catch {} return; }
    if (!req || !req.id || !req.url) return;

    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(req.url, {
        headers: { 'User-Agent': UA, 'Accept': '*/*', ...(req.headers || {}) },
        redirect: 'follow',
        signal: ac.signal,
      });
      const ab = await r.arrayBuffer();
      const buf = Buffer.from(ab).subarray(0, MAX_BODY_BYTES);
      const headers = {};
      r.headers.forEach((v, k) => { headers[k] = v; });
      headers['x-final-url'] = r.url || req.url;
      ws.send(JSON.stringify({ id: req.id, status: r.status, headers, bodyB64: buf.toString('base64') }));
      log(`${r.status}  ${req.url.split('?')[0].slice(0, 80)}  (${buf.length}b)`);
    } catch (e) {
      ws.send(JSON.stringify({ id: req.id, error: String(e && e.message || e) }));
      log('ERR ', req.url.split('?')[0].slice(0, 80), '-', String(e && e.message || e));
    } finally {
      clearTimeout(to);
    }
  });

  const retry = (why) => {
    log('disconnected', why ? `(${why})` : '', `— reconnecting in ${(backoff / 1000).toFixed(1)}s`);
    setTimeout(connect, backoff);
    backoff = Math.min(Math.round(backoff * 1.6), 5_000);
  };
  ws.addEventListener('close', (e) => retry(`code ${e.code}`));
  ws.addEventListener('error', () => { try { ws.close(); } catch {} });
}

if (KEY === 'PASTE_RELAY_KEY_HERE') {
  console.error('Set KRATOR_KEY (env var) or edit agent.mjs before running.');
  process.exit(1);
}
connect();
