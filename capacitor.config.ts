import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alexandreamine.stampaway',
  appName: 'Stampaway',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      backgroundColor: '#3B82F6',
      showSpinner: false
    }
  }
};

export default config;
