# Krator+ (masterplayerpro)

IPTV player PWA — live TV, movies and series — with a React client and a
bundled Express API. Fully self-hosted: the client talks only to its own
`/api`, backed by PostgreSQL via Prisma.

## Stack

- **Client**: React 19 + Vite 6, `vite-plugin-pwa` (offline shell, autoupdate SW)
- **Server**: Express 5 (`tsx` at runtime) — serves the built client and provides:
  - `/api/auth/*` — user login, reward-code login, heartbeat, logout
  - `/api/favorites/*` — per-user / per-device favourites
  - `/api/admin/*` — playlists, IPTV credential pool, app users, devices
    (static key in the `Authorization` header, `ADMIN_KEY` env)
  - `/api/proxy` — HTTP→HTTPS stream proxy (mixed-content fix, m3u8 rewrite)
  - `/api/m3u` — raw server-side playlist fetch (no CORS, no 3rd-party proxy)
  - `/api/tmdb/*` — poster/metadata lookup (needs `TMDB_TOKEN`, optional)
- **DB**: PostgreSQL, schema in `prisma/schema.prisma`

## Local development

```bash
npm install
cp .env.example .env      # set DATABASE_URL at least
npx prisma db push        # create the schema
npm run dev:all           # vite (5173) + api (3001)
```

`npm run dev` runs only the client; `npm run server` only the API.

## Deploy (Docker / Coolify)

The `Dockerfile` builds the client and Prisma client, then
`docker-entrypoint.sh` runs `prisma db push` (retrying until the DB is up)
and starts the server on `PORT` (default `3001`).

Required environment variables — see [`.env.example`](.env.example):

| var            | notes                                               |
| -------------- | --------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string (use the internal URL) |
| `PORT`         | server port (Coolify maps it)                       |
| `ADMIN_KEY`    | key for every `/api/admin/*` request — set a long random value |
| `TMDB_TOKEN`   | optional, TMDB v4 read token for posters            |

### First run

The database starts empty. Open `/admin`, sign in with `ADMIN_KEY`
(the username field is cosmetic), then:

1. **Playlists** → add your M3U/Xtream URL. Credentials in the URL are
   extracted automatically.
2. **Usuários → Credenciais IPTV** → add the shared IPTV account(s) and
   point them at the playlist (or a DNS).
3. **Usuários → Usuários do App** → create the accounts people log in with.

Client login then leases a credential from the pool and returns the
parsed, per-user playlist.
