import { expect, test } from "@playwright/test";
import { signUp } from "./support/account";
import { placeOrder, tokenOf } from "./support/orders";

/**
 * Two tabs on one order, which is the only way to hold a copy of it that is out of date. The screen
 * offers just the transitions its status opens, so the button that gets refused cannot be reached
 * from a single tab at all — and the refusal is the whole reason the server keeps the table too.
 */
test("a transition the order has already made is refused, and the screen catches up", async ({
  page,
  context,
  request,
}) => {
  await signUp(page);
  const id = await placeOrder(
    request,
    await tokenOf(page),
    `Cliente ${crypto.randomUUID().slice(0, 8)}`,
  );

  const stale = page;
  const moving = await context.newPage();

  await stale.goto(`/orders/${id}`);
  await moving.goto(`/orders/${id}`);

  const iniciarPreparo = { name: "Iniciar preparo" };
  await expect(stale.getByRole("button", iniciarPreparo)).toBeVisible();

  /* One tab moves the order on. The other is now holding RECEBIDO for an order that has left it. */
  await moving.getByRole("button", iniciarPreparo).click();
  await expect(
    moving.getByRole("button", { name: "Despachar para entrega" }),
  ).toBeVisible();

  /*
   * The one interception in the suite, and it buys a window rather than an answer: the PATCH is
   * still the real one and the API still refuses it. Against a local server the request is over in
   * a few milliseconds, which is too fast to catch the screen in the state below.
   */
  await stale.route("**/api/orders/*/status", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });

  const pressed = stale.getByRole("button", iniciarPreparo);
  await pressed.click();

  /*
   * While it works, the control says so and stays where it was. aria-disabled rather than disabled
   * is what makes both true at once: Chromium blurs an element the moment it is disabled and does
   * not give the focus back, so the reader would be turned out of the page at the exact moment
   * there is something to read. jsdom cannot see this — it does not implement that blur.
   */
  await expect(pressed).toBeFocused();
  await expect(pressed).toHaveAttribute("aria-disabled", "true");

  /*
   * The API answers 409 because no status lists itself, so standing still is refused by the same
   * table that refuses a jump. The screen reads the order back before saying anything, which is
   * what lets it name the status in its own words instead of quoting the API's English.
   */
  await expect(stale.getByText(/O pedido está em «Em preparo»/)).toBeVisible();

  /* And the buttons are the ones the true status opens, not the ones the stale copy had. */
  await expect(
    stale.getByRole("button", { name: "Despachar para entrega" }),
  ).toBeVisible();
  await expect(stale.getByRole("button", iniciarPreparo)).toBeHidden();

  /* The button that was pressed went with them, so the focus moves to the heading — which carries
   * the badge that just changed under the reader. */
  await expect(stale.getByRole("heading", { level: 1 })).toBeFocused();
});
