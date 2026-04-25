import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Stampaway.
 *
 * The `server.url` enables hot-reload from the Lovable sandbox so any change
 * pushed in Lovable is reflected instantly in the installed app during dev.
 *
 * IMPORTANT — for production App Store / Play Store builds:
 *   Comment out or remove the entire `server` block below so the app loads
 *   the bundled `dist/` assets instead of the live preview URL.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.29bacedb019c46d6a9a8dea7867a9954",
  appName: "Stampaway",
  webDir: "dist",
  server: {
    url: "https://29bacedb-019c-46d6-a9a8-dea7867a9954.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#000000",
  },
  android: {
    backgroundColor: "#000000",
    allowMixedContent: false,
  },
};

export default config;
