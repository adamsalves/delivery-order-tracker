import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./support/account";

/**
 * The order the whole challenge is about, walked from the sign-up form to «Entregue» against a real
 * API over real HTTP. Nothing else in the project covers this: MockMvc never crosses a socket and
 * the jsdom suite answers its own fetches, so the two sides agreeing has until now been an
 * assumption rather than a result.
 */

/** Two lines whose prices are the ones the reading of money is fussiest about: 2 × 45,90 + 10,00. */
const TOTAL = "R$ 101,80";

/**
 * The badge sits beside the order number, and the same words appear again further down the
 * timeline — so the status is read from the header that carries the heading, and not from the page.
 */
function orderHeader(page: Page) {
  return page
    .locator("header")
    .filter({ has: page.getByRole("heading", { level: 1 }) });
}

/** The timeline is the only list on this screen; the items are a table. */
function timeline(page: Page) {
  return page.getByRole("list");
}

test("an order goes from placed to delivered, and the timeline records every step", async ({
  page,
}) => {
  const account = await signUp(page);
  const customer = `Cliente ${crypto.randomUUID().slice(0, 8)}`;

  await page.getByRole("link", { name: "Novo pedido" }).click();

  await page.getByLabel("Cliente").fill(customer);
  await page.getByLabel("Endereço de entrega").fill("Rua das Flores, 42");

  const item = (position: number) =>
    page.getByRole("group", { name: `Item ${position}` });

  await item(1).getByLabel("Item", { exact: true }).fill("Pizza margherita");
  await item(1).getByLabel("Qtd.").fill("2");
  await item(1).getByLabel("Preço unit.").fill("45,90");

  await page.getByRole("button", { name: "Adicionar item" }).click();

  await item(2).getByLabel("Item", { exact: true }).fill("Refrigerante");
  await item(2).getByLabel("Qtd.").fill("1");
  await item(2).getByLabel("Preço unit.").fill("10,00");

  /* Counted in the browser from the cents the two prices were read as, before anything is sent. */
  await expect(page.locator("form")).toContainText(`Total ${TOTAL}`);

  await page.getByRole("button", { name: "Criar pedido" }).click();

  await expect(page).toHaveURL(/\/orders\/\d+$/);
  await expect(orderHeader(page)).toContainText("Recebido");

  /* The same figure again, this time priced by the server and read back off the wire. Anchored at
   * the start of the row's name, because the header row ends in "Subtotal" and would answer too. */
  await expect(page.getByRole("row", { name: /^Total/ })).toContainText(TOTAL);

  /*
   * Four steps are drawn whatever the order has reached — the path is fixed and what is missing
   * reads as pending. One of them is already stamped, because creating the order writes the first
   * history row itself so the timeline never starts empty, and it is attributed to whoever asked.
   */
  await expect(timeline(page).getByRole("listitem")).toHaveCount(4);
  await expect(timeline(page).getByText(account.email)).toHaveCount(1);
  await expect(timeline(page).getByText("Pendente")).toHaveCount(3);
  await expect(timeline(page).locator('[aria-current="step"]')).toContainText(
    "Recebido",
  );

  const steps = [
    { press: "Iniciar preparo", reaches: "Em preparo" },
    { press: "Despachar para entrega", reaches: "Saiu para entrega" },
    { press: "Confirmar entrega", reaches: "Entregue" },
  ];

  for (const [index, step] of steps.entries()) {
    await page.getByRole("button", { name: step.press }).click();

    await expect(orderHeader(page)).toContainText(step.reaches);
    await expect(timeline(page).locator('[aria-current="step"]')).toContainText(
      step.reaches,
    );

    /* One row per transition, each carrying the address the token was issued to. */
    await expect(timeline(page).getByText(account.email)).toHaveCount(
      index + 2,
    );
    await expect(timeline(page).getByText("Pendente")).toHaveCount(2 - index);
  }

  /* ENTREGUE allows nothing further, so the section that offers the next step is not there to
   * offer one — the screen stops rather than showing a control the server would refuse. */
  await expect(
    page.getByRole("heading", { name: "Próximo passo" }),
  ).toBeHidden();

  await page.getByRole("link", { name: "Pedidos" }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(
    page.getByRole("link", { name: new RegExp(customer) }),
  ).toContainText("Entregue");
});
