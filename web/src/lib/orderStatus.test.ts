import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "@/api/types";
import {
  allowedTransitions,
  describeRefusal,
  FORWARD_STATUSES,
  isTerminal,
  STATUS_LABELS,
  TRANSITION_LABELS,
} from "./orderStatus";

/** The table on the API side, in OrderStatus.allowedTransitions(). This is the copy of it. */
const API_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEBIDO: ["EM_PREPARO", "CANCELADO"],
  EM_PREPARO: ["SAIU_PARA_ENTREGA", "CANCELADO"],
  SAIU_PARA_ENTREGA: ["ENTREGUE", "CANCELADO"],
  ENTREGUE: [],
  CANCELADO: [],
};

describe("allowedTransitions", () => {
  it.each(ORDER_STATUSES)("matches the API's table for %s", (status) => {
    expect([...allowedTransitions(status)]).toEqual(API_TRANSITIONS[status]);
  });

  /* Standing still is refused by the same table that refuses a jump, and not by a rule of its own. */
  it.each(ORDER_STATUSES)(
    "does not list %s as a step from itself",
    (status) => {
      expect(allowedTransitions(status)).not.toContain(status);
    },
  );

  it.each(ORDER_STATUSES)(
    "only ever leads to a known status from %s",
    (status) => {
      for (const target of allowedTransitions(status)) {
        expect(ORDER_STATUSES).toContain(target);
      }
    },
  );

  /* Leaving the path is always open, right up until the order has already left it. */
  it.each(["RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA"] as const)(
    "keeps cancelling open from %s",
    (status) => {
      expect(allowedTransitions(status)).toContain("CANCELADO");
    },
  );
});

describe("isTerminal", () => {
  it.each(["ENTREGUE", "CANCELADO"] as const)("%s ends the order", (status) => {
    expect(isTerminal(status)).toBe(true);
  });

  it.each(["RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA"] as const)(
    "%s still has somewhere to go",
    (status) => {
      expect(isTerminal(status)).toBe(false);
    },
  );
});

describe("FORWARD_STATUSES", () => {
  /* CANCELADO is missing on purpose: it leaves the path, it is not a step on it. */
  it("is the one-way path, without the exit", () => {
    expect([...FORWARD_STATUSES]).toEqual([
      "RECEBIDO",
      "EM_PREPARO",
      "SAIU_PARA_ENTREGA",
      "ENTREGUE",
    ]);
  });

  it("walks in the order the table allows", () => {
    FORWARD_STATUSES.slice(0, -1).forEach((status, index) => {
      expect(allowedTransitions(status)).toContain(FORWARD_STATUSES[index + 1]);
    });
  });
});

describe("the label tables", () => {
  /* A status with no label renders an empty badge, which says nothing about why it is empty. */
  it.each(ORDER_STATUSES)("names %s in both tables", (status) => {
    expect(STATUS_LABELS[status]).toBeTruthy();
    expect(TRANSITION_LABELS[status]).toBeTruthy();
  });

  it("keeps the enum values Portuguese and untranslated", () => {
    expect([...ORDER_STATUSES]).toEqual([
      "RECEBIDO",
      "EM_PREPARO",
      "SAIU_PARA_ENTREGA",
      "ENTREGUE",
      "CANCELADO",
    ]);
  });
});

describe("describeRefusal", () => {
  it("says a terminal status admits nothing further", () => {
    expect(describeRefusal("ENTREGUE")).toBe(
      "O pedido está em «Entregue», que encerra o pedido e não admite outra mudança.",
    );
  });

  it("names the ways out that are still open", () => {
    expect(describeRefusal("RECEBIDO")).toBe(
      "O pedido está em «Recebido». Daqui ele só pode ir para «Em preparo» ou «Cancelado».",
    );
  });

  it.each(ORDER_STATUSES)("names the current status for %s", (status) => {
    expect(describeRefusal(status)).toContain(`«${STATUS_LABELS[status]}»`);
  });

  it.each(["RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA"] as const)(
    "names every open target for %s",
    (status) => {
      const sentence = describeRefusal(status);

      for (const target of allowedTransitions(status)) {
        expect(sentence).toContain(`«${STATUS_LABELS[target]}»`);
      }
    },
  );
});
