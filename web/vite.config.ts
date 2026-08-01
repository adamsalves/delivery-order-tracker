import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
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
});
