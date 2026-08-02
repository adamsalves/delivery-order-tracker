import { formatCurrency } from "@/lib/format";

/**
 * What a price failed to be. Kept as a reason rather than a sentence so the screen writes the
 * wording, the same way describeError leaves the phrasing of a refusal to the caller.
 */
export type AmountProblem =
  "missing" | "malformed" | "notPositive" | "tooLarge" | "tooPrecise";

export type Amount =
  | { valid: true; cents: number; text: string }
  | { valid: false; problem: AmountProblem };

/**
 * Digits with at most one decimal mark, comma or dot, since pt-BR writes the comma and the keypad
 * offers the dot. A group separator is refused rather than guessed at: "1.234" is either one
 * thousand or one and a bit, and reading it wrong changes the price by a factor of a thousand.
 */
const WRITTEN = /^(\d+)(?:[.,](\d+))?$/;

/** Mirrors @Digits(integer = 10, fraction = 2) on CreateOrderItemRequest.unitPrice. */
const MAX_INTEGER_DIGITS = 10;
const FRACTION_DIGITS = 2;

const CENTS_PER_UNIT = 100;

/**
 * Reads a typed price as a whole number of cents. Everything downstream — the subtotal, the total,
 * the body that is sent — is built from that integer, so no step of it goes through a float: 45,90
 * as a double is already not 45.90, and three of them are visibly not 137,70.
 */
export function readAmount(raw: string): Amount {
  const written = raw.trim();

  if (written === "") return { valid: false, problem: "missing" };

  const parts = WRITTEN.exec(written);
  if (parts === null) return { valid: false, problem: "malformed" };

  /* Both groups are defaulted only to satisfy the index check: group one is not optional, and the
   * empty string it would stand in for reads as zero and is refused two steps below anyway. */
  const [, whole = "", fraction = ""] = parts;

  if (fraction.length > FRACTION_DIGITS) {
    return { valid: false, problem: "tooPrecise" };
  }

  /* Leading zeros are not digits the server counts either: BigDecimal reads 007 as a single one. */
  if (whole.replace(/^0+/, "").length > MAX_INTEGER_DIGITS) {
    return { valid: false, problem: "tooLarge" };
  }

  const cents = Number(whole + fraction.padEnd(FRACTION_DIGITS, "0"));

  if (cents === 0) return { valid: false, problem: "notPositive" };

  return { valid: true, cents, text: toDecimal(cents) };
}

/**
 * The wire form: a decimal literal Jackson reads into BigDecimal exactly as written. Rebuilt from
 * the cents rather than passed through, so a comma never leaves here and the scale is always the
 * two the column stores.
 */
function toDecimal(cents: number): string {
  const whole = Math.trunc(cents / CENTS_PER_UNIT);
  const fraction = cents % CENTS_PER_UNIT;

  return `${whole}.${String(fraction).padStart(FRACTION_DIGITS, "0")}`;
}

/**
 * The one place a float is allowed, and only because Intl is on the other side of it: the division
 * is undone by rounding to the two decimals the currency has.
 */
export function formatCents(cents: number): string {
  return formatCurrency(cents / CENTS_PER_UNIT);
}
