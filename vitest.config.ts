import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": path.resolve("src/domain"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "web/**/*.test.ts"],
  },
});
