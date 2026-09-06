import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.FRONTEND_HOST ?? "127.0.0.1";
const port = Number(process.env.FRONTEND_PORT ?? "5173");

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
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
              maxSize: 450 * 1024,
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
    css: true,
    maxWorkers: 4,
    testTimeout: 20_000,
  },
});
