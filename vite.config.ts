import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        // PWABuilder requires a Service Worker, but we don't want to cache 
        // the app offline so users always get the freshest network version.
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [], // Empty caching array = no aggressive precaching
      },
      manifest: {
        name: "genjutsu — everything vanishes",
        short_name: "genjutsu",
        description: "The 24 hour social network for developers.",
        theme_color: "#0a0a0a", // Matches Tailwind dark background
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
