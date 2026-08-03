import { expect, test } from "@playwright/test";
import { signIn, signUp } from "./support/account";
import { tokenOf } from "./support/orders";
import { API_URL } from "./support/servers";

/**
 * Leaving is the part of a JWT session that is not free. The token is stateless, so ending the
 * session in the browser alone would leave it good until it expired — and a second tab would go on
 * rendering as signed in, holding a token that nothing had told it about.
 */

test("signing out revokes the token on the server, and the account still works", async ({
  page,
  request,
}) => {
  const account = await signUp(page);
  const revoked = await tokenOf(page);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  /*
   * Not merely forgotten by the browser. The logout wrote the token's jti into the revoked table,
   * and the validator composed with the standard ones consults it on every authenticated request —
   * so the token is refused from anywhere, not just from the tab that dropped it.
   */
  const refused = await request.get(`${API_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${revoked}` },
  });

  expect(refused.status()).toBe(401);

  /* What ended was the session and not the registration, which is what the login form is for. */
  await signIn(page, account);
  await expect(page.getByRole("banner")).toContainText(account.email);
});

test("signing out in one tab takes the other tab with it", async ({
  page,
  context,
}) => {
  await signUp(page);

  const other = await context.newPage();
  await other.goto("/orders");
  await expect(other.getByRole("heading", { name: "Pedidos" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  /*
   * Nothing was touched in the other tab. A browser raises the storage event only in the tabs that
   * did not make the change, and the listener re-reads rather than trusting the value it carries,
   * so a removal, a rewrite and a clear() that names no key all arrive as the same news.
   *
   * Without it this tab would keep showing a listing behind a token the API had already revoked,
   * and would only find out at its next request — which on this screen may be never.
   */
  await expect(other).toHaveURL(/\/login$/);
});
