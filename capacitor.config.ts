import type { CapacitorConfig } from '@capacitor/cli';

// The app is a thin native shell around the deployed PWA. Loading the live
// URL (instead of bundling a static build) means every web deploy reaches
// installed apps immediately — no separate APK release per content/UI change.
//
// `cleartext: true` allows the WebView to make http:// network requests at
// all (Android blocks them by default); mixed-content (http:// media loaded
// FROM an https:// page) is a separate WebView setting only a native shell
// can turn off — done in MainActivity, see android/.../MainActivity.java.
const config: CapacitorConfig = {
  appId: 'pro.appbr.krator',
  appName: 'Krator+',
  webDir: 'dist',
  server: {
    url: 'https://krator.appbr.pro',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
