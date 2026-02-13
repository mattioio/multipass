import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Custom domain serves this repo at site root; keep base configurable for future path changes.
  base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? "/multipass/" : "/"),
  server: {
    host: "127.0.0.1",
    port: 3000
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/testing/setupTests.ts",
    globals: true
  }
});
