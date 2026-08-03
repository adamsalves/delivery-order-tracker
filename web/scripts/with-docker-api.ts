/*
 * Runs the browser suite against the API in a container instead of the one ./mvnw starts.
 *
 * The container added in compose.yaml is how the application is meant to be run, but it does not
 * cover this suite, which starts an API of its own — so whoever took that path could run the app and
 * not the tests. This closes that, and becomes the default way the suite runs:
 *
 *   npm run test:e2e            # this file
 *   npm run test:e2e:ui         # this file, interactive
 *   npm run test:e2e:native     # the wrapper path, unchanged, needs the JDK
 *
 * The container comes up before Playwright rather than from inside it, so playwright.config.ts only
 * has to be told to reuse what is already listening — see reuseExistingServer there.
 *
 * Node 24 strips the types itself, so there is no build step and no loader flag.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { API_URL, WEB_URL } from "../e2e/support/servers.ts";

const COMPOSE_FILE = fileURLToPath(
  new URL("../../compose.e2e.yaml", import.meta.url),
);

/*
 * A compose project of its own, and this is the least cosmetic line in the file: `down -v` removes
 * every volume in the project it is pointed at. Sharing the default project with the development
 * stack would mean that tearing this suite down takes api-data — the development database — with it.
 */
const PROJECT = "order-tracker-e2e";
const SERVICE = "api-e2e";

/* The same budget playwright.config.ts gives the ./mvnw server. Building the image does not eat into
 * it: compose is awaited first, so this clock only starts once there is a container to wait for. */
const READY_TIMEOUT_MS = 180_000;

/** Minted per run and never written down, exactly as playwright.config.ts does for the other path. */
const JWT_SECRET = randomBytes(48).toString("base64");

const env = {
  ...process.env,
  E2E_API_PORT: new URL(API_URL).port,
  E2E_WEB_URL: WEB_URL,
  E2E_JWT_SECRET: JWT_SECRET,
  E2E_API: "docker",
};

function run(command: string, args: string[], shell = false): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env, shell });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/*
 * The plugin where it exists, the standalone script it replaced otherwise; both run this file the
 * same. -f is not about that difference — compose.e2e.yaml is not a name either of them would look
 * for on its own, which is exactly what keeps it out of a bare `docker compose up`.
 */
function composeBase(): [string, string[]] {
  const v2 = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
  const prefix: [string, string[]] =
    v2.status === 0 ? ["docker", ["compose"]] : ["docker-compose", []];

  return [prefix[0], [...prefix[1], "-f", COMPOSE_FILE, "-p", PROJECT]];
}

const [docker, base] = composeBase();
const compose = (...args: string[]) => run(docker, [...base, ...args]);

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      /* Public by design, and it only answers once the context is up — the same probe the other
       * server is checked with. */
      const response = await fetch(`${API_URL}/v3/api-docs`);
      if (response.ok) return;
    } catch {
      /* Not listening yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `A API não respondeu em ${API_URL} dentro de ${READY_TIMEOUT_MS / 1000}s.`,
  );
}

/* Ctrl-C reaches the container through the child's inherited stdio; swallowing it here keeps this
 * process alive long enough for the teardown in the finally to actually run. */
process.on("SIGINT", () => {});

/*
 * Nothing in here calls process.exit: it would skip the teardown below and leave the container, its
 * network and its volume behind. Every path sets a code and lets the finally run first.
 */
let code = 1;
try {
  /* --build because --force-recreate recreates the container and not the image: without it compose
   * only builds when the image is missing, so from the second run onwards the suite would test the
   * jar from the run before and pass green over whatever just changed in api/src.
   * --force-recreate because a container left behind by an interrupted run would still be carrying
   * that run's database, and the first spec asserts an empty one. */
  const started = await compose(
    "up",
    "-d",
    "--build",
    "--force-recreate",
    SERVICE,
  );

  if (started === 0) {
    await waitForApi();

    code = await run(
      "npx",
      ["playwright", "test", ...process.argv.slice(2)],
      process.platform === "win32",
    );
  } else {
    code = started;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  await compose("down", "-v");
}

process.exit(code);
