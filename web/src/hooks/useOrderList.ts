import { useCallback, useEffect, useState } from "react";
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

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  const hasMore = page !== null && page.number + 1 < page.totalPages;

  /*
   * The first page replaces what is held rather than adding to it. StrictMode runs this twice on
   * mount, and appending would show every order of page zero in duplicate — with duplicate keys to
   * match — before anyone had touched the pagination.
   */
  useEffect(() => {
    const controller = new AbortController();

    setPhase("loading");
    setError(null);
    setLoadMoreError(null);

    listOrders({ page: 0, signal: controller.signal })
      .then((result) => {
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
    };
  }, [attempt]);

  const loadMore = useCallback(() => {
    if (page === null || loadingMore) return;

    setLoadingMore(true);
    setLoadMoreError(null);

    listOrders({ page: page.number + 1 })
      .then((result) => {
        setOrders((held) => held.concat(absent(result.content, held)));
        setPage(result.page);
      })
      .catch((cause: unknown) => {
        setLoadMoreError(cause);
      })
      .finally(() => {
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
 */
function absent(
  arriving: OrderSummary[],
  held: OrderSummary[],
): OrderSummary[] {
  const seen = new Set(held.map((order) => order.id));

  return arriving.filter((order) => !seen.has(order.id));
}
