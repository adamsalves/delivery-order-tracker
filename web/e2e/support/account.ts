import { expect, type Page } from "@playwright/test";

export interface Account {
  email: string;
  password: string;
}

/**
 * Above the eight characters the form asks for and well under the seventy-two bytes BCrypt stops at.
 */
const PASSWORD = "e2e-password";

/**
 * A fresh account, signed up through the form, leaving the browser on the listing.
 *
 * <p>Every spec makes its own instead of sharing one. Two reasons: a spec then asserts about orders
 * it placed itself and not about whatever ran before it, and the e-mail the API writes into the
 * status history is the one this run signed up with, which makes the timeline checkable.
 */
export async function signUp(page: Page): Promise<Account> {
  const account = {
    email: `e2e-${crypto.randomUUID()}@example.com`,
    password: PASSWORD,
  };

  await page.goto("/register");
  await page.getByLabel("Nome").fill("Pessoa E2E");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/orders$/);

  return account;
}

/** The other way in, for the specs that have an account already and want the login form itself. */
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha").fill(account.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/orders$/);
}
