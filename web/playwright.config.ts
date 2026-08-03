import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { API_URL, WEB_URL } from "./e2e/support/servers";

/*
 * A pair of ports of their own, and not the 8080/5173 the README documents. Three things fall out
 * of that: the development stack can stay up while this runs, api/data/app.db is never opened, and
 * a port already taken is a failure to start rather than a suite quietly testing somebody else's
 * server. The specs that address the API directly read the same two constants.
 */
const API_PORT = new URL(API_URL).port;
const WEB_PORT = new URL(WEB_URL).port;

/**
 * Minted per run and never written down. The suite signs up its own accounts every time, so no token
 * has to outlive the process that issued it — and a secret in a file here would be one more thing to
 * keep out of the repository.
 */
const JWT_SECRET = randomBytes(48).toString("base64");

export default defineConfig({
  testDir: "./e2e",

  /*
   * One API and one SQLite file behind it. Running the specs against it in parallel would have them
   * reading each other's orders through a listing that is not scoped to an account.
   */
  workers: 1,
  fullyParallel: false,

  /* No retries. A test that only passes on the second attempt is reporting something, and a suite
   * that hides it is worth less than one that fails. */
  retries: 0,

  reporter: [["list"]],

  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  /*
   * The setup project runs first because it is declared to, not because its filename sorts first.
   * The empty-listing screen it checks is only true of a database that has just been wiped, and an
   * assertion that depends on file order is the failure mode PR #13 already cost us once.
   */
  projects: [
    {
      name: "setup",
      testMatch: /fresh-database\.setup\.ts/,
      use: devices["Desktop Chrome"],
    },
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      /*
       * The database is thrown away and remade on every run, so what the specs assert about the
       * listing is about their own orders and nothing else. WAL leaves two files beside the first.
       */
      command:
        "rm -f ./data/e2e.db ./data/e2e.db-wal ./data/e2e.db-shm && ./mvnw -q spring-boot:run",
      cwd: "../api",
      /*
       * Every one of these arrives as an environment variable, which Spring ranks above the config
       * data imported by spring.config.import — so api/.env is overridden rather than edited, and a
       * run here cannot reach the development secret or the development database.
       */
      env: {
        SERVER_PORT: API_PORT,
        SPRING_DATASOURCE_URL: "jdbc:sqlite:./data/e2e.db",
        JWT_SECRET,
        APP_CORS_ALLOWED_ORIGINS: WEB_URL,
      },
      /* Public by design — the page that says how to get a token cannot demand one — so it answers
       * 200 without authenticating, and it only answers at all once the context is up. */
      url: `${API_URL}/v3/api-docs`,
      timeout: 180_000,
      /*
       * False is what stops a run from quietly testing a server it did not start, and it stays that
       * way for the command above. The one exception is scripts/with-docker-api.ts, which brings the
       * API up in a container before Playwright is called and says so here: on that path the server
       * already answering this port is the one this very run created a moment ago, and starting a
       * second with ./mvnw would only collide with it.
       *
       * The variable is named for that claim and not for the container, because it is the only thing
       * that lowers this guard: something as guessable as E2E_API=docker sitting in a shell would
       * quietly give `npm run test:e2e:native` a server it did not start.
       */
      reuseExistingServer: process.env.E2E_API_ALREADY_STARTED === "1",
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      /*
       * The built bundle, not the dev server. The content security policy is injected by a plugin
       * that only applies on build (vite.config.ts), so a suite driving `npm run dev` would be
       * checking a page that is never the one published — and the policy is not theoretical: with
       * style-src 'self' the Chromium in this very suite refuses the style attributes Radix writes
       * to place its popover, and the sort control stops opening.
       */
      /* logLevel silences the asset table on the way past, and only that: a warning still prints,
       * and the tsc -b that runs before it is not vite's to quieten. Both servers keep their output
       * piped, because when a suite like this fails to start the reason is on one of them. */
      command: `npm run build -- --logLevel warn && npm run preview -- --port ${WEB_PORT}`,
      env: { VITE_API_URL: API_URL },
      url: WEB_URL,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
