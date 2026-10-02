/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// Versione in esecuzione: commit (da GIT_COMMIT nel build Docker, altrimenti da git) + data del build
function commit(): string {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return "dev"; }
}
const BUILD = `${commit()} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    // Config base: manifest e offline completo si rifiniscono allo step 19
    VitePWA({
      // "prompt": l'app installata non si aggiorna da sola a metà uso, chiede (ReloadPrompt)
      registerType: "prompt",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: "./", name: "Danger & Dragons", short_name: "Danger&Dragons", description: "Crea e gestisci personaggi con le regole libere dell'SRD 5.2.1, in italiano e inglese, anche senza rete.",
        lang: "it", dir: "ltr", start_url: "./", scope: "./", display: "standalone", orientation: "any", categories: ["games", "entertainment"],
        background_color: "#f3f4f8", theme_color: "#4f46e5",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Offline completo: tutto ciò che serve (anche i dati di gioco, che stanno dentro i file JS) entra nella cache del primo caricamento.
        // Il limite predefinito (2 MB) lascerebbe fuori i file grandi: senza dati di gioco nel bundle l'app non parte offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}"],
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
