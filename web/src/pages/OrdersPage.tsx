import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Loader2, Plus, RotateCw } from "lucide-react";
import type { OrderSummary } from "@/api/types";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusRail } from "@/components/StatusRail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrderList } from "@/hooks/useOrderList";
import { describeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

export function OrdersPage() {
  const {
    orders,
    page,
    phase,
    error,
    hasMore,
    loadingMore,
    loadMoreError,
    loadMore,
    reload,
  } = useOrderList();

  const countRef = useRef<HTMLParagraphElement>(null);
  const wasLoadingMore = useRef(false);

  /*
   * The button that loaded the last page unmounts with it, and focus would fall back to the body.
   * It moves to the count instead, which is both a stable target and the thing that just changed.
   */
  useEffect(() => {
    if (wasLoadingMore.current && !loadingMore && !hasMore) {
      countRef.current?.focus();
    }

    wasLoadingMore.current = loadingMore;
  }, [loadingMore, hasMore]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold font-stretch-110%">
            Pedidos
          </h1>
          {page !== null && (
            <p
              ref={countRef}
              tabIndex={-1}
              role="status"
              className="text-muted-foreground text-sm focus-visible:outline-none"
            >
              {page.totalElements === 1
                ? "1 pedido"
                : `${page.totalElements} pedidos`}
              {orders.length < page.totalElements &&
                ` · ${orders.length} carregados`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/*
           * Paging by offset only ever moves down, so an order created after the first page was
           * read sits above the window and no later page reaches it. Reading page zero again is
           * the way back to it, and the count beside this says when that is worth doing.
           *
           * Not disabled while it works: pressing it again only bumps the attempt, and the effect
           * that reads page zero aborts the read it replaces. Disabling it would take the focus off
           * the control that was just pressed, and Chromium does not give it back.
           */}
          {page !== null && (
            <Button variant="outline" onClick={reload}>
              {phase === "loading" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RotateCw />
              )}
              Atualizar
            </Button>
          )}

          <Button asChild>
            <Link to="/orders/new">
              <Plus />
              Novo pedido
            </Link>
          </Button>
        </div>
      </header>

      {/* A reload keeps the rows it already has on screen; only a first read has nothing to show. */}
      {phase === "loading" && orders.length === 0 && (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-2 py-10 text-sm"
        >
          <Loader2 className="size-4 animate-spin" />
          Carregando pedidos…
        </p>
      )}

      {phase === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar os pedidos</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{describeError(error)}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {phase === "ready" && orders.length === 0 && (
        <div className="border-border bg-card space-y-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">Nenhum pedido ainda.</p>
          <p className="text-muted-foreground text-sm">
            O primeiro pedido cadastrado aparece aqui.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderTicket order={order} />
            </li>
          ))}
        </ul>
      )}

      {loadMoreError !== null && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(loadMoreError)}</AlertDescription>
        </Alert>
      )}

      {hasMore && (
        <div className="flex justify-center">
          {/* aria-disabled and not disabled: loadMore already ignores a repeat, and taking the
              attribute route would drop the focus instead of only announcing the wait. */}
          <Button
            variant="outline"
            onClick={loadMore}
            aria-disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="animate-spin" />}
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}
    </section>
  );
}

function OrderTicket({ order }: { order: OrderSummary }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="border-border bg-card hover:border-ring/40 focus-visible:ring-ring/50 block rounded-lg border px-4 py-3 transition-colors focus-visible:ring-3 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              #{order.id}
            </span>
            <span className="truncate font-medium">{order.customerName}</span>
          </div>
          <p className="text-muted-foreground truncate text-sm">
            {order.deliveryAddress}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <OrderStatusBadge status={order.status} />
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatDateTime(order.createdAt)}
          </span>
        </div>
      </div>

      <StatusRail status={order.status} className="mt-3" />
    </Link>
  );
}
