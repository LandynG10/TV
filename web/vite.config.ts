/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { grantosDevServer } from "./devserver/plugin";

// `npm run build` writes a desktop build to web/dist.
// `npm run build:android` writes straight into the Android app's assets, which the
// native shell serves at https://grantos.local/ (see android/src/com/grantos/tv/WebAssets.java).
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), grantosDevServer()],
  build: {
    // Fire OS 6/7 ship an older Chromium WebView. ES2017 keeps the bundle loadable there.
    target: "es2017",
    outDir: mode === "android" ? resolve(__dirname, "../android/assets/web") : "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "devserver/**/*.test.ts"],
  },
}));
