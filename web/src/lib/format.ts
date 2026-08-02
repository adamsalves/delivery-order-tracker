/** Built once at module load: constructing an Intl formatter per row is the expensive part. */
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/**
 * The API sends BigDecimal as a JSON number, so 45.90 arrives as 45.9 and 10.00 as 10. Printing it
 * raw would drop the cents that were stored.
 */
export function formatCurrency(value: number): string {
  return CURRENCY.format(value);
}
