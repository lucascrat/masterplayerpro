import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gravity.kratorrewards',
  appName: 'Krator Rewards',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#150e2e',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    AdMob: {
      // AdMob App ID — placed in AndroidManifest at sync time
      appId: 'ca-app-pub-6105194579101073~8578653192',
    },
  },
  server: {
    // For release builds, the app bundles the HTML. During dev with live-reload,
    // set `url` via env to point at the dev server running on the host machine.
    androidScheme: 'https',
  },
};

export default config;
