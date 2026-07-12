import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.stampaway.mobile',
  appName: 'Stampaway',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      backgroundColor: '#3B82F6',
      showSpinner: false,
      // Keep the native splash up until the web app has resolved auth state;
      // AuthContext calls SplashScreen.hide() (with a safety timeout).
      launchAutoHide: false
    },
    CapacitorUpdater: {
      // Capgo OTA updates disabled — releases ship only through
      // App Store / TestFlight and Play Store native builds.
      autoUpdate: false
    },
    Keyboard: {
      // The app is dark-only; keep the iOS keyboard dark to match.
      style: 'DARK'
    }
  }
};

export default config;
