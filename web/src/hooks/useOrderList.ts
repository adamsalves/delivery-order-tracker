import { useCallback, useEffect, useState } from "react";
import { listOrders } from "@/api/orders";
import type { OrderSummary, PageMetadata } from "@/api/types";

export type ListPhase = "loading" | "ready" | "error";

export interface OrderList {
  orders: OrderSummary[];
  page: PageMetadata | null;
  phase: ListPhase;
  error: unknown;
  reload: () => void;
}

export function useOrderList(): OrderList {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState<PageMetadata | null>(null);
  const [phase, setPhase] = useState<ListPhase>("loading");
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  /*
   * The first page replaces what is held rather than adding to it. StrictMode runs this twice on
   * mount, and appending would show every order of page zero in duplicate — with duplicate keys to
   * match — before anyone had touched the pagination.
   */
  useEffect(() => {
    const controller = new AbortController();

    setPhase("loading");
    setError(null);

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

  return { orders, page, phase, error, reload };
}
