import { useCallback, useEffect, useRef, useState } from "react";
import { listOrders } from "@/api/orders";
import type { OrderSummary, PageMetadata } from "@/api/types";

export type ListPhase = "loading" | "ready" | "error";

export interface OrderList {
  orders: OrderSummary[];
  page: PageMetadata | null;
  phase: ListPhase;
  error: unknown;
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
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  const arrivingMore = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  const hasMore = page !== null && page.number + 1 < page.totalPages;

  /*
   * The first page replaces what is held rather than adding to it, so that reloading after a
   * failure — or after the window drifted — starts the list over instead of stacking a second copy
   * on top of whatever survived.
   */
  useEffect(() => {
    const controller = new AbortController();

    setPhase("loading");
    setError(null);
    setLoadMoreError(null);

    listOrders({ page: 0, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOrders(result.content);
        setPage(result.page);
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
       * position the list no longer sits at.
       */
      arrivingMore.current?.abort();
    };
  }, [attempt]);

  const loadMore = useCallback(() => {
    if (page === null || loadingMore) return;

    const controller = new AbortController();
    arrivingMore.current = controller;

    setLoadingMore(true);
    setLoadMoreError(null);

    listOrders({ page: page.number + 1, signal: controller.signal })
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
  }, [page, loadingMore]);

  return {
    orders,
    page,
    phase,
    error,
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
