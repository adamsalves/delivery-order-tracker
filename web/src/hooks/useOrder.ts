import { useCallback, useEffect, useState } from "react";
import { getOrder } from "@/api/orders";
import type { OrderDetail } from "@/api/types";

export type OrderPhase = "loading" | "ready" | "error";

export interface OrderResource {
  order: OrderDetail | null;
  phase: OrderPhase;
  error: unknown;
  /** Installs a detail the caller already holds, so a mutation does not have to be read back. */
  replace: (order: OrderDetail) => void;
  reload: () => void;
}

export function useOrder(id: number): OrderResource {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [phase, setPhase] = useState<OrderPhase>("loading");
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  const replace = useCallback((updated: OrderDetail) => {
    setOrder(updated);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setPhase("loading");
    setError(null);

    getOrder(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setOrder(result);
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
  }, [id, attempt]);

  return { order, phase, error, replace, reload };
}
