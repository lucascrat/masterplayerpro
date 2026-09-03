// Version: 1.0.1 - Force Cache Refresh for Serverless Migration
import { StrictMode, Suspense, lazy } from 'react'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen"><div className="spinner" /></div>}>
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
