import { expect, test } from "@playwright/test";
import { signUp } from "./support/account";

/**
 * Runs before every other spec, because the chromium project declares it as a dependency rather than
 * because of where its name falls in an alphabet.
 *
 * <p>It earns its place twice over. The empty listing is a screen no other spec can check — the
 * listing is not scoped to an account, so it is only ever empty on a database nothing has written to
 * yet — and asserting it here is what tells every spec after this one that the wipe in the API's
 * webServer command actually happened. Without it, a run against a database left over from the last
 * one would fail somewhere far from the cause.
 */
test("the run starts on an empty database", async ({ page }) => {
  await signUp(page);

  await expect(page.getByText("Nenhum pedido ainda.")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("0 pedidos");
});
