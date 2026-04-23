import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Capacitor needs a relative base so the APK/AAB can load assets from file://
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      // When running in the browser during dev, forward API calls to the Krator+ backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Single-chunk build keeps Capacitor cold start simple
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
