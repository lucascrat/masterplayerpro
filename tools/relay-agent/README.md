# Krator+ relay agent

Runs on an always-on PC with a **residential IP**. The Krator+ server (on a
datacenter IP that the IPTV provider 403s) hands this agent the small `.m3u8`
manifest URLs to fetch from your home connection, then streams the text back.

**What goes through your PC:** only live-TV manifest requests — a few KB each,
a couple per second per viewer. Roughly **1–2 MB per viewer-hour**.
**What does NOT:** video segments, movies, series, the playlist. Those stay on
the server.

## Requirements

- Node.js 21+ installed (`node --version`). Node 22 is fine.

## Run it

1. Edit `start.bat` and confirm `KRATOR_KEY` matches the server's `RELAY_KEY`.
2. Double-click `start.bat`. It keeps the agent running and restarts it if it drops.
3. Check it's linked: open <https://krator.appbr.pro/api/debug/relay> — should show
   `{"connected":true,...}`.

## Start automatically with Windows

Press `Win+R`, type `shell:startup`, Enter. Put a shortcut to `start.bat` there.
It launches on login and reconnects on its own after reboots / network drops.

## Stop

Close the `start.bat` window.
