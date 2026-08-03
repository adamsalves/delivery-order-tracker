import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { ListOrdersParams } from "@/api/orders";
import { listOrders } from "@/api/orders";
import type { OrderSummary, Paged } from "@/api/types";
import { ORDER_SORT_IDS, ORDER_SORTS } from "@/lib/orderSort";
import { useOrderList } from "./useOrderList";

vi.mock("@/api/orders", () => ({ listOrders: vi.fn() }));

/**
 * A request the hook has made and that has not answered yet. Holding the resolver is the whole point
 * of this file: every case here is about what happens in the window between asking and being told,
 * which is the one thing reading useOrderList cannot settle.
 */
interface Pending {
  params: ListOrdersParams;
  resolve: (value: Paged<OrderSummary>) => void;
  reject: (reason: unknown) => void;
}

let pending: Pending[] = [];

const asked = vi.mocked(listOrders);

beforeEach(() => {
  pending = [];
  asked.mockImplementation(
    (params: ListOrdersParams = {}) =>
      new Promise<Paged<OrderSummary>>((resolve, reject) => {
        pending.push({ params, resolve, reject });
      }),
  );
});

function order(id: number): OrderSummary {
  return {
    id,
    customerName: `Cliente ${id}`,
    deliveryAddress: `Rua ${id}`,
    status: "RECEBIDO",
    createdAt: "2026-08-02T12:00:00Z",
  };
}

function pageOf(
  ids: number[],
  { number = 0, totalPages = 1, totalElements = ids.length } = {},
): Paged<OrderSummary> {
  return {
    content: ids.map(order),
    page: { size: 20, number, totalElements, totalPages },
  };
}

/** Resolves the request at `index` and lets React apply whatever it caused. */
async function answer(index: number, body: Paged<OrderSummary>) {
  await act(async () => {
    pending[index]?.resolve(body);
  });
}

async function refuse(index: number, cause: unknown) {
  await act(async () => {
    pending[index]?.reject(cause);
  });
}

function sortOf(index: number) {
  return {
    sort: pending[index]?.params.sort,
    direction: pending[index]?.params.direction,
  };
}

async function loaded(ids: number[], options?: { totalPages?: number }) {
  const list = renderHook(() => useOrderList());
  await answer(0, pageOf(ids, options));

  return list;
}

describe("the first read", () => {
  it("asks for page zero in the default order", async () => {
    renderHook(() => useOrderList());

    expect(asked).toHaveBeenCalledTimes(1);
    expect(pending[0]?.params).toMatchObject({
      page: 0,
      sort: "createdAt",
      direction: "desc",
    });
  });

  it("holds the rows it is given", async () => {
    const { result } = await loaded([1, 2]);

    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2]);
    expect(result.current.phase).toBe("ready");
    expect(result.current.everLoaded).toBe(true);
  });
});

describe("changing the order", () => {
  /*
   * The case that needed a browser to check, twice. A page already asked for in the old order is
   * still on its way when the order changes, and appending it afterwards would put rows of the order
   * the caller just abandoned underneath rows of the one they chose.
   */
  it("does not let a page of the old order land under rows of the new one", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.loadingMore).toBe(true);
    expect(pending).toHaveLength(2);

    act(() => {
      result.current.setSort("customer-az");
    });

    /* The page in flight belongs to the abandoned order; answering it must change nothing. */
    await answer(1, pageOf([3, 4], { number: 1, totalPages: 2 }));

    expect(result.current.orders).toEqual([]);

    await answer(2, pageOf([9, 8]));

    expect(result.current.orders.map((o) => o.id)).toEqual([9, 8]);
  });

  it("puts loadingMore back down when the page it was waiting for is abandoned", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    act(() => {
      result.current.loadMore();
    });
    act(() => {
      result.current.setSort("customer-az");
    });

    await answer(1, pageOf([3, 4], { number: 1, totalPages: 2 }));

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(false);
    });
  });

  /*
   * Rows in the order just abandoned are wrong and not merely stale, so they go at once rather than
   * when the answer arrives. Emptying the pagination with them is what stops loadMore from reading
   * page one of an order whose page zero has not landed.
   */
  it("empties the list at once rather than when the new order arrives", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    act(() => {
      result.current.setSort("oldest");
    });

    expect(result.current.orders).toEqual([]);
    expect(result.current.page).toBeNull();
    expect(result.current.hasMore).toBe(false);
    /* everLoaded stays up, so the control that was just used is not unmounted from under the focus. */
    expect(result.current.everLoaded).toBe(true);
  });

  /*
   * Guards the early return in setSort. Without it, choosing the option already selected would empty
   * the list and read it back for nothing — and its removal breaks nothing visible at first, which
   * is exactly why it needs a test rather than a comment.
   */
  it("does nothing when handed the order it already holds", async () => {
    const { result } = await loaded([1, 2]);

    act(() => {
      result.current.setSort("newest");
    });

    expect(asked).toHaveBeenCalledTimes(1);
    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2]);
    expect(result.current.page).not.toBeNull();
  });

  it.each(ORDER_SORT_IDS.filter((id) => id !== "newest"))(
    "asks for %s with the property and direction its entry names",
    async (id) => {
      const { result } = await loaded([1]);

      act(() => {
        result.current.setSort(id);
      });

      expect(sortOf(1)).toEqual({
        sort: ORDER_SORTS[id].property,
        direction: ORDER_SORTS[id].direction,
      });
      expect(result.current.sort).toBe(id);
    },
  );

  it("asks for newest with what its entry names, on the first read", async () => {
    renderHook(() => useOrderList());

    expect(sortOf(0)).toEqual({
      sort: ORDER_SORTS.newest.property,
      direction: ORDER_SORTS.newest.direction,
    });
  });
});

describe("retrying", () => {
  /*
   * A failure while changing the order leaves the hook holding the new sort and nothing to show. The
   * retry has to go out in that new order — reading the old one back would answer a question the
   * caller has already stopped asking.
   */
  it("retries the order that failed, not the one before it", async () => {
    const { result } = await loaded([1, 2]);

    act(() => {
      result.current.setSort("address-za");
    });
    await refuse(1, new ApiError(500, "boom", null));

    expect(result.current.phase).toBe("error");

    act(() => {
      result.current.reload();
    });

    expect(sortOf(2)).toEqual({
      sort: "deliveryAddress",
      direction: "desc",
    });
  });

  it("keeps the rows on screen while a reload is in flight", async () => {
    const { result } = await loaded([1, 2]);

    act(() => {
      result.current.reload();
    });

    /* Only stale, not wrong — unlike a change of order, which empties the list. */
    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2]);
    expect(result.current.phase).toBe("loading");
  });

  it("replaces rather than stacks a second copy on a reload", async () => {
    const { result } = await loaded([1, 2]);

    act(() => {
      result.current.reload();
    });
    await answer(1, pageOf([1, 2]));

    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2]);
  });
});

describe("loading more", () => {
  it("appends the next page and moves the pagination on", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    await answer(1, pageOf([3, 4], { number: 1, totalPages: 2 }));

    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2, 3, 4]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
  });

  /*
   * Pagination is by offset, so an order created between two requests pushes the window down and
   * hands back a row that is already held. Concatenating blindly would render it twice, under a key
   * React has already seen.
   */
  it("drops a row the offset drift handed back twice", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    act(() => {
      result.current.loadMore();
    });
    await answer(1, pageOf([2, 3], { number: 1, totalPages: 2 }));

    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2, 3]);
  });

  it("ignores a repeat press while a page is already on its way", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    act(() => {
      result.current.loadMore();
    });
    act(() => {
      result.current.loadMore();
    });

    expect(asked).toHaveBeenCalledTimes(2);
  });

  it("reports a failed page without disturbing the rows already held", async () => {
    const { result } = await loaded([1, 2], { totalPages: 2 });

    act(() => {
      result.current.loadMore();
    });
    await refuse(1, new ApiError(500, "boom", null));

    expect(result.current.loadMoreError).toBeInstanceOf(ApiError);
    expect(result.current.orders.map((o) => o.id)).toEqual([1, 2]);
    expect(result.current.phase).toBe("ready");
  });
});
