import { Link } from "react-router";
import { Loader2, Plus } from "lucide-react";
import type { OrderSummary } from "@/api/types";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { StatusRail } from "@/components/StatusRail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrderList } from "@/hooks/useOrderList";
import { describeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

export function OrdersPage() {
  const { orders, page, phase, error, reload } = useOrderList();

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold font-stretch-110%">
            Pedidos
          </h1>
          {page !== null && (
            <p className="text-muted-foreground text-sm">
              {page.totalElements === 1
                ? "1 pedido"
                : `${page.totalElements} pedidos`}
              {orders.length < page.totalElements &&
                ` · ${orders.length} carregados`}
            </p>
          )}
        </div>

        <Button asChild>
          <Link to="/orders/new">
            <Plus />
            Novo pedido
          </Link>
        </Button>
      </header>

      {phase === "loading" && (
        <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
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
