import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  resolve: {
    alias: {
      "@domain": path.resolve("src/domain"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});
