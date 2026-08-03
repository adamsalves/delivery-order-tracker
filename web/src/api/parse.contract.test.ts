import { describe, expect, it } from "vitest";
import loginRecorded from "./__fixtures__/login-response.json";
import detailRecorded from "./__fixtures__/order-detail.json";
import pageRecorded from "./__fixtures__/orders-page.json";
import registerRecorded from "./__fixtures__/register-response.json";
import {
  loginResponse,
  orderDetail,
  orderSummaries,
  registerResponse,
  ShapeError,
  type Parser,
} from "./parse";
import { ORDER_STATUSES } from "./types";

/*
 * These fixtures are recorded from a running API by scripts/record-fixtures.ts, not written here.
 * A body invented in this file would agree with the parser by construction, which is the one thing
 * a contract test must not do.
 */

/**
 * Members the API sent that the parser did not read. This is the direction parse.ts cannot fail in
 * on its own: a member it does not know about is silently dropped, so a field the API starts
 * sending — or renames — leaves no trace at all. ShapeError already covers the other direction.
 */
function unreadMembers(
  recorded: unknown,
  parsed: unknown,
  path = "response",
): string[] {
  if (Array.isArray(recorded)) {
    if (!Array.isArray(parsed)) return [path];

    return recorded.flatMap((entry, index) =>
      unreadMembers(entry, parsed[index], `${path}[${index}]`),
    );
  }

  if (typeof recorded !== "object" || recorded === null) return [];
  if (typeof parsed !== "object" || parsed === null) return [path];

  const held = parsed as Record<string, unknown>;

  return Object.entries(recorded).flatMap(([key, value]) =>
    key in held
      ? unreadMembers(value, held[key], `${path}.${key}`)
      : [`${path}.${key}`],
  );
}

/** Reruns a parser over a copy of the body with one member taken out. */
function without(recorded: object, key: string): unknown {
  const { [key]: _removed, ...rest } = recorded as Record<string, unknown>;

  return rest;
}

const contracts = [
  ["registerResponse", registerResponse, registerRecorded],
  ["loginResponse", loginResponse, loginRecorded],
  ["orderDetail", orderDetail, detailRecorded],
  ["orderSummaries", orderSummaries, pageRecorded],
] as const satisfies readonly (readonly [string, Parser<unknown>, object])[];

describe.each(contracts)(
  "%s against a recorded response",
  (_name, parse, recorded) => {
    it("reads it without refusing", () => {
      expect(() => parse(recorded, "response")).not.toThrow();
    });

    it("reads every member the API sent", () => {
      expect(unreadMembers(recorded, parse(recorded, "response"))).toEqual([]);
    });
  },
);

describe("what the recording proves about the wire format", () => {
  const detail = orderDetail(detailRecorded, "response");

  /*
   * The claim the whole of money.ts rests on, now recorded rather than asserted from memory: the API
   * stores BigDecimal at scale two and Jackson writes it as a JSON number, so 45.90 comes back as
   * 45.9 and 10.00 as 10. Printing either raw would drop the cents.
   */
  it("sends a price as a number that has already lost its trailing zero", () => {
    expect(detail.items.map((item) => item.unitPrice)).toEqual([45.9, 10]);
    expect(detailRecorded.items[0]?.unitPrice).not.toBe("45.90");
  });

  /* The row the order is created with has no origin, which is why optionalStatus exists. */
  it("sends a null fromStatus on the row creation writes", () => {
    expect(detail.history[0]).toMatchObject({
      fromStatus: null,
      toStatus: "RECEBIDO",
    });
  });

  it("sends every later history row with the status it came from", () => {
    for (const entry of detail.history.slice(1)) {
      expect(entry.fromStatus).not.toBeNull();
    }
  });

  it("sends status values from the five the front knows", () => {
    expect(ORDER_STATUSES).toContain(detail.status);

    for (const entry of detail.history) {
      expect(ORDER_STATUSES).toContain(entry.toStatus);
    }
  });

  /* PagedModel, not Page<T>: the metadata is nested under `page` and has exactly these four. */
  it("nests the pagination under page with the four members the listing reads", () => {
    expect(Object.keys(pageRecorded.page).sort()).toEqual([
      "number",
      "size",
      "totalElements",
      "totalPages",
    ]);
  });

  it("sends a listing row without the items or history the detail carries", () => {
    const summary = pageRecorded.content[0];

    expect(summary).toBeDefined();
    expect(summary).not.toHaveProperty("items");
    expect(summary).not.toHaveProperty("history");
  });
});

describe("when the two sides drift apart", () => {
  it.each(["id", "customerName", "status", "createdAt", "items", "history"])(
    "refuses a detail missing %s, and names it",
    (key) => {
      expect(() =>
        orderDetail(without(detailRecorded, key), "response"),
      ).toThrow(ShapeError);
      expect(() =>
        orderDetail(without(detailRecorded, key), "response"),
      ).toThrow(`response.${key}`);
    },
  );

  it("refuses a status outside the five, rather than rendering an empty badge", () => {
    const drifted = { ...detailRecorded, status: "OUT_FOR_DELIVERY" };

    expect(() => orderDetail(drifted, "response")).toThrow(ShapeError);
    expect(() => orderDetail(drifted, "response")).toThrow("response.status");
  });

  it("names the row inside a collection that broke", () => {
    const drifted = {
      ...detailRecorded,
      items: [
        detailRecorded.items[0],
        { ...detailRecorded.items[1], quantity: "2" },
      ],
    };

    expect(() => orderDetail(drifted, "response")).toThrow(
      "response.items[1].quantity",
    );
  });

  it("refuses a page whose content is not a list", () => {
    expect(() =>
      orderSummaries({ ...pageRecorded, content: {} }, "response"),
    ).toThrow("response.content");
  });
});
