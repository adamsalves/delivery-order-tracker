import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  /*
   * The port is the one the API names in app.cors.allowed-origins. Letting Vite fall forward to the
   * next free port would turn every call into a CORS failure instead of a refusal to start.
   */
  server: {
    port: 5173,
    strictPort: true,
  },
  /*
   * The suite is configured here rather than in a vitest.config.ts of its own, so that the `@` alias
   * and the react plugin have one definition and cannot drift from what the application is built
   * with — a test resolving an import differently from the bundle is a test of something else.
   *
   * No `globals`. The tests import describe, it and expect the same way the rest of the codebase
   * imports everything else, which also keeps `types` out of tsconfig.app.json.
   */
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
  },
});
