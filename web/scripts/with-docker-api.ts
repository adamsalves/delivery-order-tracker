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

/* Long enough that a slow first response is not read as a dead server, short enough that a peer
 * which accepts and then says nothing cannot sit on the whole budget above. */
const PROBE_TIMEOUT_MS = 2_000;

/** Minted per run and never written down, exactly as playwright.config.ts does for the other path. */
const JWT_SECRET = randomBytes(48).toString("base64");

const env = {
  ...process.env,
  E2E_API_PORT: new URL(API_URL).port,
  E2E_WEB_URL: WEB_URL,
  E2E_JWT_SECRET: JWT_SECRET,
  E2E_API: "docker",
};

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/*
 * The plugin where it exists, the standalone script it replaced otherwise; both run this file the
 * same. -f is not about that difference — compose.e2e.yaml is not a name either of them would look
 * for on its own, which is exactly what keeps it out of a bare `docker compose up`.
 *
 * Neither being present is answered here rather than left to the first spawn, because the audience
 * for this script is people who do not have the JDK: telling them "spawn docker-compose ENOENT",
 * naming a tool they never asked for, is the wrong way to say that Docker is missing.
 */
function detectCompose(): [string, string[]] {
  const has = (command: string, args: string[]) =>
    spawnSync(command, args, { stdio: "ignore" }).status === 0;

  const prefix: [string, string[]] | undefined = has("docker", [
    "compose",
    "version",
  ])
    ? ["docker", ["compose"]]
    : has("docker-compose", ["--version"])
      ? ["docker-compose", []]
      : undefined;

  if (!prefix) {
    throw new Error(
      "Docker Compose was not found: neither `docker compose` nor `docker-compose` is on PATH. " +
        "Install Docker, or run the suite with `npm run test:e2e:native`, which needs the JDK instead.",
    );
  }

  return [prefix[0], [...prefix[1], "-f", COMPOSE_FILE, "-p", PROJECT]];
}

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (cancelled) throw new Error("Interrupted while waiting for the API.");

    try {
      /* Public by design, and it only answers once the context is up — the same probe the other
       * server is checked with. Bounded because a peer that accepts the connection and then never
       * answers would otherwise hold this loop for the whole budget on a single attempt. */
      const response = await fetch(`${API_URL}/v3/api-docs`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (response.ok) return;
    } catch {
      /* Not listening yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `The API did not answer at ${API_URL} within ${READY_TIMEOUT_MS / 1000}s.`,
  );
}

/*
 * Set by SIGINT rather than acted on there. Ctrl-C reaches the children through the foreground
 * process group, so whatever is running dies on its own; what the handler has to do is stop this
 * process from exiting with it, or the teardown below never runs and the container is left behind.
 * The wait loop reads this, because a handler that only swallows the signal makes the wait itself
 * uninterruptible — Ctrl-C during it did nothing and the only way out ran the teardown over.
 */
let cancelled = false;
process.on("SIGINT", () => {
  cancelled = true;
});

/*
 * Nothing in here calls process.exit: it would skip the teardown below and leave the container, its
 * network and its volume behind. Every path sets a code and lets the finally run first.
 */
let compose: ((...args: string[]) => Promise<number>) | undefined;
let code = 1;

try {
  const [docker, base] = detectCompose();
  compose = (...args: string[]) => run(docker, [...base, ...args]);

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

    /* npx.cmd rather than spawning through a shell on Windows: with a shell, Node joins the
     * arguments with spaces and quotes none of them, so `-- --grep "two words"` arrives split. */
    code = await run(process.platform === "win32" ? "npx.cmd" : "npx", [
      "playwright",
      "test",
      ...process.argv.slice(2),
    ]);
  } else {
    code = started;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);

  /* The container is detached, so nothing of its output has been printed, and the teardown below is
   * about to remove it along with its log. An API that came up and died — a secret under 32 bytes
   * is enough — otherwise reports as three minutes of silence and no reason anywhere. */
  await compose?.("logs", "--no-color", SERVICE).catch(() => {});
} finally {
  /* Awaited without a guard this could reject — the daemon going away mid-run is enough — and a
   * rejection escaping a finally at the top level of a module skips the exit below entirely, so the
   * run ends on a stack trace and an accidental code. A teardown that fails also has to be able to
   * fail the run: the README promises nothing is left over, and a green suite exiting 0 beside a
   * container still up is that promise broken where nobody looks. */
  const tornDown = compose
    ? await compose("down", "-v").catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        return 1;
      })
    : 0;

  if (code === 0 && tornDown !== 0) code = tornDown;
}

process.exit(code);
