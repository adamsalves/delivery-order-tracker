import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The policy is built here rather than written into index.html because one of its directives is not
 * a constant: connect-src has to name the API, and the API's origin comes from VITE_API_URL.
 *
 * <p>Build only. The dev server serves an inline module preamble and talks to itself over a
 * websocket for hot reload, so a policy tight enough to be worth having would refuse its own tooling
 * — and `npm run dev` is not what gets deployed. Check it with `npm run preview`, which serves the
 * built output.
 *
 * <p>frame-ancestors is deliberately absent: a browser ignores it when it arrives in a meta element,
 * and a directive that silently does nothing is worse than none. Clickjacking protection has to come
 * from a response header wherever this is hosted.
 */
function contentSecurityPolicy(apiOrigin: string): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    /*
     * Radix positions its popovers by writing style attributes as they open, and CSP counts those
     * as inline styles. The alternative is a nonce, which a static build has nowhere to mint per
     * request. The cost is bounded: script-src stays strict, which is the directive that decides
     * whether injected markup can execute.
     */
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: policy },
          injectTo: "head-prepend",
        },
      ],
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const { VITE_API_URL = "http://localhost:8080" } = loadEnv(
    mode,
    process.cwd(),
    "VITE_",
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicy(new URL(VITE_API_URL).origin),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    /*
     * The port is the one the API names in app.cors.allowed-origins. Letting Vite fall forward to
     * the next free port would turn every call into a CORS failure instead of a refusal to start.
     * preview answers on the same one for the same reason — it is the build being checked against a
     * real API, and the API only trusts that origin.
     */
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 5173,
      strictPort: true,
    },
    /*
     * The suite is configured here rather than in a vitest.config.ts of its own, so that the `@`
     * alias and the react plugin have one definition and cannot drift from what the application is
     * built with — a test resolving an import differently from the bundle is a test of something
     * else.
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
  };
});
