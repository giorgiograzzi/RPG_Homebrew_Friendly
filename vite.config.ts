/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Config base: manifest e offline completo si rifiniscono allo step 19
    VitePWA({
      // "prompt": l'app installata non si aggiorna da sola a metà uso, chiede (ReloadPrompt)
      registerType: "prompt",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: "./", name: "Personaggi D&D", short_name: "D&D PG", description: "Crea e gestisci personaggi di D&D 5.5 (2024), in italiano, anche senza rete.",
        lang: "it", dir: "ltr", start_url: "./", scope: "./", display: "standalone", orientation: "any", categories: ["games", "entertainment"],
        background_color: "#ece9d8", theme_color: "#0a3fb5",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Offline completo: tutto ciò che serve (anche i dati di gioco, che stanno dentro i file JS) entra nella cache del primo caricamento.
        // Il limite predefinito (2 MB) lascerebbe fuori i file grandi: senza dati di gioco nel bundle l'app non parte offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}", "forms/*.pdf"], // la scheda PDF (5 MB) c'è dal primo caricamento: si stampa anche offline
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // La pagina non va tenuta in cache: dopo ogni build i file hanno nomi nuovi e un index.html vecchio (PWA in Home su iOS) punterebbe a file spariti
  preview: { headers: { "Cache-Control": "no-cache, must-revalidate" } },
  server: { headers: { "Cache-Control": "no-cache, must-revalidate" } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
