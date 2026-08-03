/*
 * Records real API responses as the fixtures the contract test reads.
 *
 * api/parse.ts is a hand-written parser whose whole job is catching drift between the two sides,
 * and nothing checked it against anything the API had actually sent — so the guard was itself
 * unguarded. These fixtures close that, and they are recorded rather than written by hand for the
 * obvious reason: a body invented here would agree with the parser by construction.
 *
 * Point it at a throwaway database and a throwaway secret, never at the development one:
 *
 *   cd api
 *   SPRING_DATASOURCE_URL=jdbc:sqlite:./data/fixtures.db \
 *   JWT_SECRET=$(openssl rand -base64 48) ./mvnw spring-boot:run
 *
 *   cd web && node scripts/record-fixtures.ts
 *
 * Node 24 strips the types itself, so there is no build step and no loader flag.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = (process.env.API_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/api/__fixtures__",
);

/*
 * The account is made fresh on every run so the recording never depends on what is already in the
 * database. The address is deliberately unremarkable: these files are committed, so nothing real
 * belongs in them.
 */
const ACCOUNT = {
  name: "Fixture User",
  email: `fixtures+${Date.now()}@example.com`,
  password: "fixture-password",
};

/**
 * The token is recorded as a placeholder rather than as the one that came back. What the contract
 * test needs from this member is that it is a string called `token`, which a placeholder states
 * just as well — and a signed JWT committed to a repository is a thing that reads as a credential
 * to every scanner that finds it, however worthless the key behind it was.
 */
const REDACTED_TOKEN =
  "<recorded token removed: see scripts/record-fixtures.ts>";

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} answered ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function save(name: string, body: unknown): Promise<void> {
  await writeFile(
    join(OUT, `${name}.json`),
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8",
  );
  console.log(`  ${name}.json`);
}

function idOf(order: unknown): number {
  const id = (order as { id?: unknown }).id;

  if (typeof id !== "number")
    throw new Error("Created order came back with no id");

  return id;
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  console.log(`Recording from ${API_URL}`);

  const register = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(ACCOUNT),
  });

  const login = (await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: ACCOUNT.email, password: ACCOUNT.password }),
  })) as { token: string };

  const auth = { Authorization: `Bearer ${login.token}` };

  /*
   * Three orders, so the listing has something to page and something to sort. The prices are the
   * ones the front's own reading is fussiest about: a scale-two decimal that comes back as 45.9,
   * and a whole number that comes back as 10.
   */
  const created: unknown[] = [];
  for (const [index, customer] of [
    "Ana Souza",
    "Bruno Lima",
    "Carla Dias",
  ].entries()) {
    created.push(
      await call("/api/orders", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          customerName: customer,
          deliveryAddress: `Rua das Flores, ${100 + index}`,
          items: [
            { name: "Pizza margherita", quantity: 2, unitPrice: "45.90" },
            { name: "Refrigerante", quantity: 1, unitPrice: "10.00" },
          ],
        }),
      }),
    );
  }

  /* Moved twice, so the detail fixture carries a history with more than the row creation writes —
   * including one entry whose fromStatus is null, which is the case optionalStatus exists for. */
  const moved = idOf(created[0]);
  for (const status of ["EM_PREPARO", "SAIU_PARA_ENTREGA"]) {
    await call(`/api/orders/${moved}/status`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ status }),
    });
  }

  const detail = await call(`/api/orders/${moved}`, { headers: auth });

  /* size=2 against three orders, so totalPages is greater than one and the metadata is real. */
  const page = await call(
    "/api/orders?page=0&size=2&sort=createdAt,desc&sort=id,desc",
    {
      headers: auth,
    },
  );

  await save("register-response", register);
  await save("login-response", { ...login, token: REDACTED_TOKEN });
  await save("order-detail", detail);
  await save("orders-page", page);

  console.log("Done.");
}

await main();
