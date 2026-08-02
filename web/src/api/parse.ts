import {
  ORDER_STATUSES,
  type LoginResponse,
  type OrderDetail,
  type OrderItem,
  type OrderStatus,
  type OrderStatusEntry,
  type OrderSummary,
  type Paged,
  type PageMetadata,
  type RegisterResponse,
} from "./types";

/**
 * Turns a body into the type a caller asked for, or refuses. The return types here are checked
 * against the interfaces rather than asserted onto them: a member read as the wrong kind, or left
 * out, is a compile error in this file instead of undefined surfacing three screens away.
 */
export type Parser<T> = (value: unknown, path: string) => T;

/** Names the member that broke rather than the response it was buried in. */
export class ShapeError extends Error {
  constructor(path: string, expected: string, found: unknown) {
    super(`Expected ${expected} at ${path}, found ${describe(found)}`);
    this.name = "ShapeError";
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return `"${value}"`;

  return typeof value;
}

/**
 * Own enumerable members only, which is exactly what JSON carries. Reading through the prototype
 * would find a constructor on every object and call that a member the API sent.
 */
function members(value: unknown, path: string): ReadonlyMap<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ShapeError(path, "an object", value);
  }

  const found = new Map<string, unknown>();
  for (const [key, member] of Object.entries(value)) found.set(key, member);

  return found;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string") throw new ShapeError(path, "a string", value);

  return value;
}

/** NaN and the infinities are rejected: JSON cannot spell them, so one means a broken producer. */
function numeric(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ShapeError(path, "a number", value);
  }

  return value;
}

/**
 * The enum is the contract's narrowest part and the likeliest to drift, since the two sides keep
 * separate copies of it. A value outside the five would otherwise reach a lookup table, miss, and
 * render an empty badge with nothing said about why.
 */
function orderStatus(value: unknown, path: string): OrderStatus {
  const name = text(value, path);
  const known = ORDER_STATUSES.find((candidate) => candidate === name);

  if (known === undefined) {
    throw new ShapeError(path, `one of ${ORDER_STATUSES.join(", ")}`, name);
  }

  return known;
}

function reader(value: unknown, path: string) {
  const found = members(value, path);
  const at = (key: string) => `${path}.${key}`;

  return {
    text: (key: string) => text(found.get(key), at(key)),
    numeric: (key: string) => numeric(found.get(key), at(key)),
    status: (key: string) => orderStatus(found.get(key), at(key)),

    /** Null is a value the column holds, so it is accepted here and absence still is not. */
    optionalStatus: (key: string) => {
      const member = found.get(key);

      return member === null ? null : orderStatus(member, at(key));
    },

    each: <T>(key: string, item: Parser<T>) => {
      const member = found.get(key);
      if (!Array.isArray(member)) {
        throw new ShapeError(at(key), "an array", member);
      }

      const entries: unknown[] = member;

      return entries.map((entry, index) => item(entry, `${at(key)}[${index}]`));
    },

    nested: <T>(key: string, parse: Parser<T>) =>
      parse(found.get(key), at(key)),
  };
}

const orderItem: Parser<OrderItem> = (value, path) => {
  const read = reader(value, path);

  return {
    id: read.numeric("id"),
    name: read.text("name"),
    quantity: read.numeric("quantity"),
    unitPrice: read.numeric("unitPrice"),
  };
};

const orderStatusEntry: Parser<OrderStatusEntry> = (value, path) => {
  const read = reader(value, path);

  return {
    id: read.numeric("id"),
    fromStatus: read.optionalStatus("fromStatus"),
    toStatus: read.status("toStatus"),
    changedAt: read.text("changedAt"),
    changedBy: read.text("changedBy"),
  };
};

const orderSummary: Parser<OrderSummary> = (value, path) => {
  const read = reader(value, path);

  return {
    id: read.numeric("id"),
    customerName: read.text("customerName"),
    deliveryAddress: read.text("deliveryAddress"),
    status: read.status("status"),
    createdAt: read.text("createdAt"),
  };
};

const pageMetadata: Parser<PageMetadata> = (value, path) => {
  const read = reader(value, path);

  return {
    size: read.numeric("size"),
    number: read.numeric("number"),
    totalElements: read.numeric("totalElements"),
    totalPages: read.numeric("totalPages"),
  };
};

function pageOf<T>(item: Parser<T>): Parser<Paged<T>> {
  return (value, path) => {
    const read = reader(value, path);

    return {
      content: read.each("content", item),
      page: read.nested("page", pageMetadata),
    };
  };
}

export const registerResponse: Parser<RegisterResponse> = (value, path) => {
  const read = reader(value, path);

  return {
    id: read.numeric("id"),
    name: read.text("name"),
    email: read.text("email"),
  };
};

export const loginResponse: Parser<LoginResponse> = (value, path) => {
  const read = reader(value, path);

  return {
    token: read.text("token"),
    expiresIn: read.numeric("expiresIn"),
  };
};

export const orderDetail: Parser<OrderDetail> = (value, path) => {
  const read = reader(value, path);

  return {
    id: read.numeric("id"),
    customerName: read.text("customerName"),
    deliveryAddress: read.text("deliveryAddress"),
    status: read.status("status"),
    createdAt: read.text("createdAt"),
    updatedAt: read.text("updatedAt"),
    items: read.each("items", orderItem),
    history: read.each("history", orderStatusEntry),
  };
};

export const orderSummaries: Parser<Paged<OrderSummary>> = pageOf(orderSummary);
