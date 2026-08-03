import { describe, expect, it } from "vitest";
import { SORTABLE_ORDER_PROPERTIES } from "@/api/types";
import {
  DEFAULT_ORDER_SORT,
  isOrderSortId,
  ORDER_SORT_IDS,
  ORDER_SORTS,
} from "./orderSort";

describe("ORDER_SORTS", () => {
  /*
   * The listing answers 400 for a property it does not sort on, so an entry here that the API does
   * not accept is a broken control and not a degraded one. The two tables are separate copies of the
   * same fact, which is the reason to check them against each other rather than against a literal.
   */
  it.each(ORDER_SORT_IDS)("%s sorts on a property the API accepts", (id) => {
    expect(SORTABLE_ORDER_PROPERTIES).toContain(ORDER_SORTS[id].property);
  });

  it("has an entry for every id, and no entry without one", () => {
    expect(Object.keys(ORDER_SORTS).sort()).toEqual([...ORDER_SORT_IDS].sort());
  });

  it.each(ORDER_SORT_IDS)("%s is labelled", (id) => {
    expect(ORDER_SORTS[id].label).not.toBe("");
  });

  it("gives every property both directions", () => {
    const offered = ORDER_SORT_IDS.map(
      (id) => `${ORDER_SORTS[id].property},${ORDER_SORTS[id].direction}`,
    );

    expect([...offered].sort()).toEqual([
      "createdAt,asc",
      "createdAt,desc",
      "customerName,asc",
      "customerName,desc",
      "deliveryAddress,asc",
      "deliveryAddress,desc",
    ]);
  });

  /*
   * Both omissions are deliberate and neither is obvious from the table alone. `id` orders by
   * creation, which the first two entries already say, and it rides along as the tie-breaker anyway.
   * `status` is stored with EnumType.STRING, so the database orders it alphabetically — CANCELADO,
   * EM_PREPARO, ENTREGUE, RECEBIDO, SAIU_PARA_ENTREGA — which is not the order the rail draws.
   */
  it.each(["id", "status"] as const)(
    "leaves %s out even though the API would accept it",
    (property) => {
      expect(SORTABLE_ORDER_PROPERTIES).toContain(property);

      const offered = ORDER_SORT_IDS.map((id) => ORDER_SORTS[id].property);
      expect(offered).not.toContain(property);
    },
  );
});

describe("DEFAULT_ORDER_SORT", () => {
  it("is one of the offered ids", () => {
    expect(ORDER_SORT_IDS).toContain(DEFAULT_ORDER_SORT);
  });

  /* @PageableDefault on OrderController is createdAt DESC, so the first read asks for what it
   * would have been given anyway and the control opens naming it. */
  it("matches what the controller would have applied", () => {
    expect(ORDER_SORTS[DEFAULT_ORDER_SORT]).toMatchObject({
      property: "createdAt",
      direction: "desc",
    });
  });
});

describe("isOrderSortId", () => {
  it.each(ORDER_SORT_IDS)("accepts %s", (id) => {
    expect(isOrderSortId(id)).toBe(true);
  });

  it.each(["", "newest ", "NEWEST", "status", "createdAt"])(
    "refuses %j",
    (value) => {
      expect(isOrderSortId(value)).toBe(false);
    },
  );

  /*
   * The case Object.hasOwn is there for. `in` reads through the prototype, so it would answer true
   * for these, and the lookup that follows would hand back a function to destructure a property and
   * a direction out of.
   */
  it.each([
    "toString",
    "constructor",
    "hasOwnProperty",
    "__proto__",
    "valueOf",
  ])(
    "refuses %j, which the prototype would otherwise answer for",
    (inherited) => {
      expect(isOrderSortId(inherited)).toBe(false);
    },
  );
});
