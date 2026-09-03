// Version: 1.0.1 - Force Cache Refresh for Serverless Migration
import { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Admin panel is a separate bundle — regular viewers never download it.
const Admin = lazy(() => import('./Admin.tsx'))

// Register service worker with auto-update
registerSW({
  onNeedRefresh() {
    // New content available — auto update silently
    console.log('[PWA] New version available, updating...');
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
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
