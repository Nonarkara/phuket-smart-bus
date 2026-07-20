import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [react()],
  assetsInclude: [],
  json: {
    stringify: false
  },
  base: process.env.GITHUB_PAGES === "true" ? "/phuket-smart-bus/" : "/",
  define: {
    APP_VERSION: JSON.stringify(pkg.version)
  },
  // Surface VITE_ env vars to the client bundle
  // VITE_GISTDA_API_KEY is baked at build time so it's available for tile URLs.
  // Tile URLs expose the key in network requests anyway — this key is for
  // rate-limiting, not security. Never put private secrets in VITE_ vars.
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 4173
  },
  build: {
    outDir: "dist/client",
    chunkSizeWarningLimit: 1300
  },
  test: {
    globals: true,
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**", ".claude/**", ".worktrees/**"],
    setupFiles: ["./src/test/setup.ts"]
  }
});
