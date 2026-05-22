import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Route-level code splitting (via React.lazy in App.tsx) already keeps
    // the entry small. We intentionally do NOT split vendor libraries into
    // manual chunks because mapbox-gl's worker/CSS init and chunk loading
    // inside the iOS Capacitor WebView are unreliable when isolated, which
    // breaks both globes. Let Rollup decide vendor chunking automatically.
    chunkSizeWarningLimit: 1500,
  },
}));
