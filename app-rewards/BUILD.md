# Krator Rewards — Build & Release Guide

Companion Android app for the Krator+ IPTV player. Users earn coins by watching
AdMob rewarded videos (1 coin = 2h of access), redeem their persistent
`KRT-XXXXXX` code on the main app's login screen.

## Stack
- Vite + React 19 + Tailwind v4 (CSS-first theme)
- Capacitor 8 → Android (AAB ready for Play Store)
- Backend: same Express/Prisma/Postgres as Krator+ main app, new `/api/rewards/*` routes

## Quick start (dev)

```bash
cd app-rewards
npm install
npm run dev          # browser dev at http://localhost:5174
                     # proxy /api → http://localhost:3001 (main Krator+ backend)
```

Make sure the main Krator+ server is running (`npm run server` in the repo root).

## Mobile dev build (APK for testing on a phone)

```bash
npm run cap:sync     # builds web + copies into android/
npm run cap:open     # opens Android Studio
```

In Android Studio: **Run → app** (with a connected device / emulator).

## Production config — pointing at the real backend

In production (installed APK/AAB), `/api` calls must hit a real backend URL.
Set `VITE_API_BASE` at build time:

```bash
VITE_API_BASE=https://app.krator.com.br npm run cap:sync
```

The URL is baked into the bundle — no runtime env.

## Generating the signed AAB for Play Store

### 1. Create an upload keystore (one-time, keep forever)

From `app-rewards/android/`:

```bash
mkdir -p keystore
keytool -genkey -v \
  -keystore keystore/krator-rewards-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias krator-upload
```

It prompts for two passwords (store + key) and your identity info. **Save the
passwords in a password manager** — losing them means you can't publish updates.

### 2. Create `android/keystore.properties`

Copy `android/keystore.properties.example` to `android/keystore.properties`
and fill in the passwords you just set. **This file is gitignored.**

### 3. Build the AAB

```bash
cd app-rewards
VITE_API_BASE=https://app.krator.com.br npm run cap:sync
cd android
./gradlew bundleRelease       # Windows: gradlew.bat bundleRelease
```

Output:
```
android/app/build/outputs/bundle/release/app-release.aab
```

This is the file you upload to Play Console.

### 4. Upload to Play Console

- Create the app at https://play.google.com/console
- Enroll in **Play App Signing** (recommended) — Google manages the final signing key
- Upload `app-release.aab` to an internal/closed/production track
- Fill in store listing (icon, screenshots, description, privacy policy)
- **Data safety form:** declare advertising ID usage (AdMob)

## Icons & splash (optional but recommended)

Drop a 1024×1024 `icon.png` and a `splash.png` (min 2732×2732) at
`app-rewards/resources/`, then:

```bash
npx @capacitor/assets generate --android
```

## AdMob configuration

Already wired in `src/lib/admob.ts` and `android/app/src/main/AndroidManifest.xml`:

| Type          | Unit ID                                     |
| ------------- | ------------------------------------------- |
| App ID        | `ca-app-pub-6105194579101073~8578653192`    |
| Rewarded      | `ca-app-pub-6105194579101073/1188929949`    |
| Banner        | `ca-app-pub-6105194579101073/8171459080`    |
| Interstitial  | `ca-app-pub-6105194579101073/4973308463`    |

Before going live: **add test devices** in AdMob Console to avoid accidentally
clicking your own ads (which gets accounts banned).

## Economy

- New user: starts with **5 coins** (= 10h welcome)
- Rewarded video: **+1 coin**
- Daily cap: **10 videos/day** per device (~20h/day max)
- Cooldown: **30s** between videos
- Nonce TTL: **5min** (one-time, prevents replaying a single ad watch)

Change in `server/routes/rewardsRoutes.ts` constants at the top.

## What the user sees

1. First open → app calls `/api/rewards/register { deviceId }` → saves code locally + shows 5 starter coins
2. Tap "Assistir agora" → server issues nonce → AdMob plays rewarded ad → on reward, server validates nonce + credits 1 coin
3. Tap "Meu código" → shows `KRT-XXXXXX` + copy button
4. User opens Krator+ main app → "Código" tab on login → types code → server decrements 1 coin, grants 2h, creates IPTV session
5. Timer badge in top-right corner shows remaining access time; session auto-logs out when it hits zero
