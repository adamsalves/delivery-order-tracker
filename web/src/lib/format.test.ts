import { describe, expect, it } from "vitest";
import { formatAlternatives, formatCurrency, formatDateTime } from "./format";

/** Intl separates the symbol and the digits with a non-breaking space, not the one on a keyboard. */
function plain(text: string): string {
  return text.replace(/ /g, " ");
}

describe("formatDateTime", () => {
  it("writes an instant in the short pt-BR form", () => {
    expect(formatDateTime("2026-08-02T15:30:00Z")).toMatch(
      /^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/,
    );
  });

  /*
   * This runs inside a render with no boundary above it, and Intl throws on an invalid date. A
   * single malformed timestamp answering instead of throwing is the difference between one dash in
   * a column and a blank screen.
   */
  it.each(["", "not a date", "2026-13-45T99:99:99Z"])(
    "answers a dash for %j rather than throwing",
    (raw) => {
      expect(formatDateTime(raw)).toBe("—");
    },
  );
});

describe("formatCurrency", () => {
  /* BigDecimal arrives as a JSON number, so 45.90 comes as 45.9 and 10.00 as 10. */
  it("restores the cents the wire form dropped", () => {
    expect(plain(formatCurrency(45.9))).toBe("R$ 45,90");
    expect(plain(formatCurrency(10))).toBe("R$ 10,00");
    expect(plain(formatCurrency(0))).toBe("R$ 0,00");
  });

  it("groups thousands the way pt-BR writes them", () => {
    expect(plain(formatCurrency(1234.5))).toBe("R$ 1.234,50");
  });
});

describe("formatAlternatives", () => {
  /* Joined with "ou" and not a comma, because the items are choices and not a sequence. */
  it("joins choices with ou", () => {
    expect(formatAlternatives(["«Em preparo»", "«Cancelado»"])).toBe(
      "«Em preparo» ou «Cancelado»",
    );
  });

  it("leaves a single choice alone", () => {
    expect(formatAlternatives(["«Entregue»"])).toBe("«Entregue»");
  });

  it("keeps the last one separate in a longer list", () => {
    expect(formatAlternatives(["a", "b", "c"])).toBe("a, b ou c");
  });
});
