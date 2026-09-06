import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const host = process.env.FRONTEND_HOST ?? "127.0.0.1";
const port = Number(process.env.FRONTEND_PORT ?? "5173");

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    // The Prompt domain is intentionally one 575 kB (154 kB gzip) chunk. A max-size split creates
    // a cyclic schema/domain chunk graph that WebKitGTK can evaluate before its enum exports exist.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: "forms-vendor",
              test: /node_modules[\\/](?:@hookform|react-hook-form|zod)[\\/]/,
              priority: 30,
            },
            {
              name: "prompt-features",
              test: /src[\\/]prompt-studio[\\/](?:domain|features|store)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              maxSize: 450 * 1024,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  server: {
    host,
    port,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [...configDefaults.exclude, "e2e/**"],
    css: true,
    maxWorkers: 4,
    testTimeout: 20_000,
  },
});
