import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const host = process.env.FRONTEND_HOST ?? "127.0.0.1";
const port = Number(process.env.FRONTEND_PORT ?? "5173");

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host,
    port,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
