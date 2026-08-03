import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { API_URL } from "./servers";

/**
 * The key the application stores its session under, written out rather than imported from
 * `src/auth/session.ts`. Reaching into the source would make the test agree with it by
 * construction, and where the token lives is one of the things this suite is here to state.
 */
const STORAGE_KEY = "order-tracker.session";

/** The token the browser is holding, taken from where the application put it. */
export async function tokenOf(page: Page): Promise<string> {
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY,
  );

  expect(stored, `No session under ${STORAGE_KEY}`).not.toBeNull();

  const token: unknown = JSON.parse(stored ?? "").token;

  if (typeof token !== "string") {
    throw new Error(`The stored session carries no token: ${stored}`);
  }

  return token;
}

/**
 * Places an order straight through the API, for the specs whose subject is what happens to an order
 * afterwards. The form that writes one is covered where it is the point — `order-lifecycle.spec.ts`
 * — and driving it again here would only make these slower and their failures less specific.
 */
export async function placeOrder(
  request: APIRequestContext,
  token: string,
  customerName: string,
): Promise<number> {
  const response = await request.post(`${API_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      customerName,
      deliveryAddress: "Rua das Flores, 42",
      items: [{ name: "Pizza margherita", quantity: 1, unitPrice: "45.90" }],
    },
  });

  expect(response.status(), await response.text()).toBe(201);

  /* Built out of what came back rather than renamed into a shape, the same way the fixture recorder
   * reads this id: the number is checked because everything after it depends on there being one. */
  const created: unknown = await response.json();
  const id = (created as { id?: unknown }).id;

  if (typeof id !== "number") {
    throw new Error("The created order came back with no id");
  }

  return id;
}
