// Version: 1.0.1 - Force Cache Refresh for Serverless Migration
import { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Admin panel is a separate bundle — regular viewers never download it.
const Admin = lazy(() => import('./Admin.tsx'))

// Service worker: apply new versions immediately and keep checking. A stale
// cached bundle in an installed PWA / long-lived Chrome tab was serving the
// old (broken) player. This forces the update through and reloads once.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] new version — applying');
    updateSW(true); // skipWaiting + reload
  },
  onRegisteredSW(_swUrl, reg) {
    if (!reg) return;
    // Nuke any legacy runtime caches (old builds cached /api/proxy responses).
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => {
        if (k.startsWith('api-cache') || k.startsWith('workbox-runtime')) caches.delete(k);
      })).catch(() => {});
    }
    // Poll for updates so an always-open PWA doesn't sit on an old build.
    reg.update().catch(() => {});
    setInterval(() => reg.update().catch(() => {}), 60_000);
  },
  onOfflineReady() {
    console.log('[PWA] ready to work offline');
  },
});

// NOTE: no <StrictMode> — its dev-mode double-invoke of effects makes the
// video player open TWO upstream connections per play, which trips the
// IPTV provider's simultaneous-connection limit and stalls playback.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
      <Routes>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </Suspense>
  </BrowserRouter>,
)
