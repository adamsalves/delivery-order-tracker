import { useCallback, useEffect, useRef, useState } from "react";
import { listOrders } from "@/api/orders";
import type { OrderSummary, PageMetadata } from "@/api/types";
import {
  DEFAULT_ORDER_SORT,
  ORDER_SORTS,
  type OrderSortId,
} from "@/lib/orderSort";

export type ListPhase = "loading" | "ready" | "error";

export interface OrderList {
  orders: OrderSummary[];
  page: PageMetadata | null;
  phase: ListPhase;
  error: unknown;

  /**
   * True once a page has arrived, and never false again. It is what separates the very first read
   * from one that emptied the list to change its order, which the other fields describe
   * identically — and the sort control has to stay mounted through the second, or the focus that
   * was on it when it was used falls back to the body.
   */
  everLoaded: boolean;
  sort: OrderSortId;
  setSort: (sort: OrderSortId) => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: unknown;
  loadMore: () => void;
  reload: () => void;
}

export function useOrderList(): OrderList {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState<PageMetadata | null>(null);
  const [phase, setPhase] = useState<ListPhase>("loading");
  const [error, setError] = useState<unknown>(null);
  const [everLoaded, setEverLoaded] = useState(false);
  const [sort, setSortId] = useState<OrderSortId>(DEFAULT_ORDER_SORT);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  const arrivingMore = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  /*
   * A reload leaves the rows on screen and lets the arriving page replace them, because they are
   * only stale. A change of order makes them wrong instead — they are in the order the caller just
   * stopped asking for — so they go now rather than when the answer arrives. Emptying the page
   * along with them is what stops loadMore from reading page one of an order whose page zero has
   * not landed yet, and what takes "Carregar mais" off a list with nothing under it.
   */
  const setSort = useCallback(
    (next: OrderSortId) => {
      if (next === sort) return;

      setOrders([]);
      setPage(null);
      setSortId(next);
    },
    [sort],
  );

  const hasMore = page !== null && page.number + 1 < page.totalPages;

  /*
   * The first page replaces what is held rather than adding to it, so that reloading after a
   * failure — or after the window drifted — starts the list over instead of stacking a second copy
   * on top of whatever survived. That is also the whole of what a change of order needs: the sort
   * sits in the dependencies, and the read it triggers overwrites rather than appends, so rows in
   * two different orders never end up in one list.
   */
  useEffect(() => {
    const controller = new AbortController();
    const { property, direction } = ORDER_SORTS[sort];

    setPhase("loading");
    setError(null);
    setLoadMoreError(null);

    listOrders({
      page: 0,
      sort: property,
      direction,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOrders(result.content);
        setPage(result.page);
        setEverLoaded(true);
        setPhase("ready");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause);
        setPhase("error");
      });

    return () => {
      controller.abort();
      /*
       * A read of page zero supersedes any later page still on its way: appending that one
       * afterwards would leave a gap where the pages it replaced used to be, and hand the count a
       * position the list no longer sits at. After a change of order it would be worse still — a
       * page of the order just abandoned, landing under rows of the new one.
       */
      arrivingMore.current?.abort();
    };
  }, [attempt, sort]);

  const loadMore = useCallback(() => {
    if (page === null || loadingMore) return;

    const controller = new AbortController();
    arrivingMore.current = controller;
    const { property, direction } = ORDER_SORTS[sort];

    setLoadingMore(true);
    setLoadMoreError(null);

    listOrders({
      page: page.number + 1,
      sort: property,
      direction,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOrders((held) => held.concat(absent(result.content, held)));
        setPage(result.page);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoadMoreError(cause);
      })
      .finally(() => {
        if (arrivingMore.current === controller) arrivingMore.current = null;
        setLoadingMore(false);
      });
  }, [page, loadingMore, sort]);

  return {
    orders,
    page,
    phase,
    error,
    everLoaded,
    sort,
    setSort,
    hasMore,
    loadingMore,
    loadMoreError,
    loadMore,
    reload,
  };
}

/**
 * Pagination is by offset, so an order created between two requests pushes the window down and
 * hands back a row that is already held. Concatenating blindly would render it twice, under a key
 * React has already seen.
 *
 * <p>Only half of that drift is answerable here. The order that caused it entered above the window
 * and no later page will ever reach it, which is why the count says how many of the total are
 * loaded and reload() is offered next to it: reading page zero again is the only way back to it.
 */
function absent(
  arriving: OrderSummary[],
  held: OrderSummary[],
): OrderSummary[] {
  const seen = new Set(held.map((order) => order.id));

  return arriving.filter((order) => !seen.has(order.id));
}
