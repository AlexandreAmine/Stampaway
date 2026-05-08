import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Stampaway.
 *
 * Build modes:
 *   - DEV (default `npm run dev` / `npm run build:dev`):
 *       CAP_ENV=dev → loads from the live Lovable preview URL (hot reload).
 *   - PRODUCTION (`npm run build`, used for App Store / Play Store):
 *       CAP_ENV unset → loads bundled `dist/` assets.
 *       Live updates still ship via Capgo (over-the-air JS bundle updates),
 *       so any change you make in Lovable can reach installed apps without
 *       resubmitting to the stores.
 */
const isDev = process.env.CAP_ENV === "dev";

const config: CapacitorConfig = {
  appId: "app.lovable.29bacedb019c46d6a9a8dea7867a9954",
  appName: "Stampaway",
  webDir: "dist",
  ...(isDev
    ? {
        server: {
          url: "https://29bacedb-019c-46d6-a9a8-dea7867a9954.lovableproject.com?forceHideBadge=true",
          cleartext: true,
        },
      }
    : {}),
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
    // Capgo OTA live updates — production only.
    // Auto-checks for new bundles on every app launch + resume, downloads in
    // background, and applies on next launch. Fully App Store / Play Store
    // compliant (JS/CSS/HTML only, no native code changes).
    CapacitorUpdater: {
      autoUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
      directUpdate: true,
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
