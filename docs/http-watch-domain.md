# HTTP-only watch domain (live TV without the VPS in the loop)

## Why this exists

The main app (`https://krator.appbr.pro`) can never load an `http://` video
directly — that's mixed content, blocked unconditionally by the browser
engine, not something our code can opt out of. Movies/series work around
this because their CDN (`fenix7.cdnw6houk4vl.link` at last check) actually
serves HTTPS — `/api/resolve` + the player's `direct` mode picks that up
automatically, no extra setup needed.

Live channels are different: their CDN (`unicacdn.app` at last check) has
**no TLS at all**. No client-side trick fixes that — the only way to play it
in a normal browser tab with zero bytes through our own server is a page
that is *itself* plain `http://`, so loading `http://` video inside it isn't
"mixed" content anymore (same scheme on both sides).

`GET /watch?url=<stream url>` (see `server/index.ts`) is that page — a
static-ish HTML file with `hls.js` that plays whatever `url` you give it.
It works today at `https://krator.appbr.pro/watch?...` too, technically, but
loading it from an `https://` origin doesn't help: the *page* being https
doesn't matter, what matters is the origin the *browser tab's address bar*
shows when it fetches the video. So it only solves anything when reached
through a plain-http origin.

## One-time setup in Coolify

1. Open the **startflix** app (uuid `na3u55ydst5584n5nw29gcer`) → **Domains**.
2. Add a new domain, e.g. `play.appbr.pro` (any free subdomain works —
   `krator.appbr.pro` itself is taken by the main https domain).
3. **Do not** let Coolify provision a certificate for it, and turn off any
   "force HTTPS / redirect to HTTPS" toggle for that domain specifically —
   it must stay reachable as plain `http://`. If Coolify's UI ties SSL and
   the redirect together per-app rather than per-domain, this may need a
   second, minimal app/service pointed at the same image instead of a second
   domain on the same app — check what the domains panel allows before
   assuming either way.
4. Set the env var on the app (shared with the main domain, same container):
   ```
   HTTP_WATCH_ORIGIN=http://play.appbr.pro
   ```
5. Redeploy. `GET /api/config` should now return
   `{"httpWatchOrigin":"http://play.appbr.pro"}`, and the player's error
   screen shows an "Assistir sem travar ↗" link for live channels that opens
   `http://play.appbr.pro/watch?url=...` in a new tab.

## What NOT to expect

- It will always show "Not secure" in the address bar — that's inherent to
  plain HTTP, not a bug.
- It can't be embedded (`<iframe>`) inside the main app's page — an http://
  iframe inside an https:// page is mixed content too. It only works as a
  top-level tab the user navigates to, hence `target="_blank"`.
- It's a manual "escape hatch" link today (see `HlsPlayer.tsx`), not an
  automatic redirect — nobody is forced into the "Not secure" tab, they opt
  in when the in-app player can't play a channel.
- If the provider ever adds TLS to that CDN, this whole page becomes
  unnecessary — re-check with the curl recipe in the project's IPTV capacity
  investigation before assuming it's still needed.
