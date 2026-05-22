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
    // Most heavy deps are isolated into their own chunks below so route
    // bundles stay small and shared deps cache well across navigations.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // NOTE: do NOT split mapbox-gl into its own chunk — its worker/CSS
          // initialization breaks when isolated and the globe renders blank.
          if (id.includes("react-simple-maps") || id.includes("d3-")) return "simplemaps";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("recharts")) return "charts";
          if (id.includes("qrcode.react")) return "qrcode";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "react-query";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("embla-carousel")) return "embla";
        },
      },
    },
  },
}));
