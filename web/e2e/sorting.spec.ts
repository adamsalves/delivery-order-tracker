import { expect, test } from "@playwright/test";
import { signUp } from "./support/account";
import { placeOrder, tokenOf } from "./support/orders";
import { API_URL } from "./support/servers";

/**
 * The sort control against the policy the build ships, which is the pairing that matters: the
 * content security policy is injected by a plugin that only applies on build, and the one directive
 * that had to be loosened was loosened because of this very control. Radix writes style attributes
 * to place the popover and `style-src 'self'` counts those as inline styles. Nothing else in the
 * project runs against the built bundle, so nothing else can see this.
 *
 * <p>The console is what catches it rather than the interaction. Putting the directive back to
 * `style-src 'self'` was tried: the listbox still answers a click here, and the eighteen refusals
 * the browser reported are the only sign anything is wrong. That is the argument for watching the
 * console at all — a policy can break the placing of a popover without breaking a test that only
 * presses it.
 */
test("the sort control opens under the policy and reorders through the API", async ({
  page,
  request,
}) => {
  /* Attached before the first navigation, so nothing refused on the way in goes unheard. */
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  await signUp(page);
  const token = await tokenOf(page);

  /* Two names at the ends of the alphabet, so which of them leads the list is the answer to the
   * question and not an accident of what else the run has placed. */
  const suffix = crypto.randomUUID().slice(0, 8);
  const first = `Ana ${suffix}`;
  const last = `Zeca ${suffix}`;

  await placeOrder(request, token, first);
  await placeOrder(request, token, last);

  await page.reload();

  /*
   * The policy is read off the page before anything is said about violations of it. A run against a
   * bundle that shipped without one would otherwise report a clean console and mean nothing by it.
   * connect-src naming the API is the directive that cannot be a constant — it is built from
   * VITE_API_URL — so finding this port in it says the policy was generated for this very server.
   */
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");

  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain(`connect-src 'self' ${API_URL}`);

  const control = page.getByRole("combobox", { name: "Ordenar por" });
  const leading = page.getByRole("list").getByRole("listitem").first();

  for (const [choice, expected] of [
    ["Cliente A–Z", first],
    ["Cliente Z–A", last],
  ] as const) {
    await control.click();
    await page.getByRole("option", { name: choice }).click();

    await expect(control).toContainText(choice);
    /* The order is asked of the API, which orders the rows; nothing here is sorted in the browser. */
    await expect(leading).toContainText(expected);
  }

  expect(violations).toEqual([]);
});
