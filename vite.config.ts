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
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-toast', 'lucide-react'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'remark-gemoji'],
          'vendor-syntax': ['react-syntax-highlighter'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-i18n': ['i18next', 'react-i18next']
        }
      }
    }
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
        theme_color: "#9B78C2",
        background_color: "#9B78C2",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"  // home screen app icon
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"      // high-res app icon (adaptive)
          },
          {
            src: "/splash-image.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"           // used for splash screen
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
