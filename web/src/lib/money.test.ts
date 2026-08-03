import { describe, expect, it } from "vitest";
import { centsOf, formatCents, readAmount, type Amount } from "./money";

/** Narrows for the assertion, so a refusal fails the test here instead of at `.cents` below. */
function accepted(raw: string): Extract<Amount, { valid: true }> {
  const amount = readAmount(raw);

  if (!amount.valid) {
    throw new Error(`Expected ${raw} to be read, got ${amount.problem}`);
  }

  return amount;
}

function refused(raw: string) {
  const amount = readAmount(raw);

  if (amount.valid) {
    throw new Error(`Expected ${raw} to be refused, got ${amount.cents}`);
  }

  return amount.problem;
}

describe("readAmount", () => {
  it("reads a whole number as cents", () => {
    expect(accepted("10").cents).toBe(1000);
  });

  it("reads the comma pt-BR writes", () => {
    expect(accepted("45,90").cents).toBe(4590);
  });

  it("reads the dot the keypad offers", () => {
    expect(accepted("45.90").cents).toBe(4590);
  });

  it("pads a single decimal place", () => {
    expect(accepted("45,9").cents).toBe(4590);
  });

  it("trims before reading", () => {
    expect(accepted("  45,90  ").cents).toBe(4590);
  });

  /*
   * The pair the parser exists to tell apart. Both are a dot-or-comma followed by three digits, and
   * reading either as the other changes what the person typing was understood to have said.
   */
  it("refuses a dot and three digits as a thousands separator", () => {
    expect(refused("1.234")).toBe("grouped");
  });

  it("reads a comma and three digits as a price with too many places", () => {
    expect(refused("1,234")).toBe("tooPrecise");
  });

  it("refuses more decimal places than the column stores", () => {
    expect(refused("45,901")).toBe("tooPrecise");
  });

  it("refuses an empty field as missing rather than malformed", () => {
    expect(refused("")).toBe("missing");
    expect(refused("   ")).toBe("missing");
  });

  it.each(["abc", "45,", "R$ 45,90", "-45,90", "4 5", "45,9,9", ",90"])(
    "refuses %j as malformed",
    (raw) => {
      expect(refused(raw)).toBe("malformed");
    },
  );

  it("refuses zero however it is written", () => {
    expect(refused("0")).toBe("notPositive");
    expect(refused("0,00")).toBe("notPositive");
    expect(refused("000")).toBe("notPositive");
  });

  /* @Digits(integer = 10) on the API side, and BigDecimal reads 007 as one digit, not three. */
  it("accepts ten integer digits and refuses eleven", () => {
    expect(accepted("9999999999,99").cents).toBe(999999999999);
    expect(refused("99999999999")).toBe("tooLarge");
  });

  it("does not count leading zeros against the ceiling", () => {
    expect(accepted("00000000000000042").cents).toBe(4200);
  });

  it("sends the wire form with a dot and two places, never the comma typed", () => {
    expect(accepted("45,90").text).toBe("45.90");
    expect(accepted("45,9").text).toBe("45.90");
    expect(accepted("10").text).toBe("10.00");
    expect(accepted("0,05").text).toBe("0.05");
  });
});

describe("centsOf", () => {
  /* The API sends BigDecimal as a JSON number, so a stored 45.90 arrives as 45.9. */
  it("recovers the cents of a scale-two decimal read as a float", () => {
    expect(centsOf(45.9)).toBe(4590);
    expect(centsOf(10)).toBe(1000);
    expect(centsOf(0.05)).toBe(5);
  });

  it("multiplies a line without drifting", () => {
    expect(centsOf(45.9) * 3).toBe(13770);
  });

  /*
   * The reason the whole module works in integers, shown rather than asserted. Summed as floats and
   * converted at the end, these six prices come to 6655.999999999999 — a cent short of the truth the
   * moment anything truncates it. Converted first and summed as integers, the total is exact.
   */
  it("sums a list of prices without losing a cent to the float", () => {
    const prices = [0.1, 0.2, 0.3, 45.9, 19.99, 0.07];

    const inCents = prices.reduce((held, price) => held + centsOf(price), 0);
    const asFloats = prices.reduce((held, price) => held + price, 0) * 100;

    expect(inCents).toBe(6656);
    expect(Math.trunc(asFloats)).toBe(6655);
  });
});

describe("formatCents", () => {
  it("writes the currency back with both places", () => {
    /* Intl uses a non-breaking space after the symbol, which is not the one on the keyboard. */
    expect(formatCents(4590).replace(/ /g, " ")).toBe("R$ 45,90");
    expect(formatCents(1000).replace(/ /g, " ")).toBe("R$ 10,00");
  });
});
