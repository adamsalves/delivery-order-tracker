import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Loader2, Plus, RotateCw } from "lucide-react";
import type { OrderSummary, PageMetadata } from "@/api/types";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusRail } from "@/components/StatusRail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrderList, type ListPhase } from "@/hooks/useOrderList";
import { describeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { ORDER_SORT_IDS, ORDER_SORTS, isOrderSortId } from "@/lib/orderSort";

export function OrdersPage() {
  const {
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
  } = useOrderList();

  const countRef = useRef<HTMLParagraphElement>(null);
  const wasLoadingMore = useRef(false);

  /*
   * The button that loaded the last page unmounts with it, and focus would fall back to the body.
   * It moves to the count instead, which is both a stable target and the thing that just changed.
   *
   * A change of order reaches the first three terms by another road — it empties the pagination,
   * so nothing is left to load more of — and there the focus belongs to the control that was just
   * used. The page tells the two apart: only an arriving last page leaves one behind.
   */
  useEffect(() => {
    if (wasLoadingMore.current && !loadingMore && !hasMore && page !== null) {
      countRef.current?.focus();
    }

    wasLoadingMore.current = loadingMore;
  }, [loadingMore, hasMore, page]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold font-stretch-110%">
            Pedidos
          </h1>
          <p
            ref={countRef}
            tabIndex={-1}
            role="status"
            className="text-muted-foreground text-sm focus-visible:outline-none"
          >
            {listSummary({ everLoaded, phase, page, loaded: orders.length })}
          </p>
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
           *
           * Held by everLoaded rather than by the pagination, which a change of order clears: this
           * would otherwise leave the header for as long as that read takes and come back once it
           * lands, moving everything under it twice over an order that was already chosen.
           */}
          {everLoaded && (
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

      {/*
       * Kept mounted from the first page onwards, including while the order it was just given is
       * being read. Hiding it during that read would take the focus off the control that started
       * it — and the list it sorts is empty at that moment precisely because it was used.
       */}
      {everLoaded && (
        <div className="flex items-center gap-2">
          {/*
           * Named by reference and not only by htmlFor. A button is labelable, so the association
           * is valid, but what a browser makes of it is its own business: the accessible name of a
           * button is otherwise built from its own content, which here is the current value.
           * Pointing at the label settles which of the two is the name, and leaves the value where
           * a listbox already reports it.
           */}
          <Label
            id="order-sort-label"
            htmlFor="order-sort"
            className="text-muted-foreground text-sm"
          >
            Ordenar por
          </Label>
          <Select
            value={sort}
            onValueChange={(chosen) => {
              if (isOrderSortId(chosen)) setSort(chosen);
            }}
          >
            <SelectTrigger
              id="order-sort"
              aria-labelledby="order-sort-label"
              className="w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_SORT_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {ORDER_SORTS[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/*
       * A reload keeps the rows it already has on screen; only a first read has nothing to show.
       * Hidden from the accessibility tree because the summary in the header is saying the same
       * thing from a region that was already there to be heard.
       */}
      {phase === "loading" && orders.length === 0 && (
        <p
          aria-hidden="true"
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

/**
 * The one live region on the screen, which is why the paragraph holding it is mounted from the
 * first render and only ever changes text. A region added to the DOM already carrying its words is
 * not announced, so a count that arrives with the rows it counts says nothing — and a change of
 * order, which empties the list and refills it, would pass in silence.
 */
function listSummary({
  everLoaded,
  phase,
  page,
  loaded,
}: {
  everLoaded: boolean;
  phase: ListPhase;
  page: PageMetadata | null;
  loaded: number;
}): string {
  if (page !== null) {
    const total =
      page.totalElements === 1 ? "1 pedido" : `${page.totalElements} pedidos`;

    return loaded < page.totalElements
      ? `${total} · ${loaded} carregados`
      : total;
  }

  /*
   * Before the first page there is nothing here to say that the body is not already showing, and
   * a failure is the alert's to report. Between the two, an empty pagination means the order
   * changed and the read that follows it is the news.
   */
  return everLoaded && phase === "loading" ? "Carregando pedidos…" : "";
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
