import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [react()],
  define: {
    APP_VERSION: JSON.stringify(pkg.version)
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.API_PORT ?? "3099"}`
    }
  },
  build: {
    outDir: "dist/client"
  },
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./src/test/setup.ts"]
  }
});
