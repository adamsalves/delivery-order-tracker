import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { OrderDetail } from "@/api/types";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrder } from "@/hooks/useOrder";
import { describeError } from "@/lib/errors";
import { formatCurrency, formatDateTime } from "@/lib/format";

const NOT_FOUND = { 404: "Pedido não encontrado." };

export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);

  /*
   * A path that is not a number never becomes a request: the API would answer 400 for it, and a
   * refusal is a poorer thing to show than simply saying the order is not there.
   */
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return <Missing />;
  }

  return <LoadedOrder id={orderId} />;
}

function LoadedOrder({ id }: { id: number }) {
  const { order, phase, error, reload } = useOrder(id);

  if (phase === "loading") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Carregando pedido…
      </p>
    );
  }

  if (phase === "error" || order === null) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar o pedido</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{describeError(error, NOT_FOUND)}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink />
      <Header order={order} />
      <Items order={order} />
    </div>
  );
}

function Missing() {
  return (
    <div className="space-y-4">
      <BackLink />
      <Alert variant="destructive">
        <AlertTitle>Pedido não encontrado</AlertTitle>
        <AlertDescription>
          O endereço não aponta para um pedido válido.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/orders"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
    >
      <ArrowLeft className="size-4" />
      Pedidos
    </Link>
  );
}

function Header({ order }: { order: OrderDetail }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold font-stretch-110%">
          Pedido{" "}
          <span className="font-mono tabular-nums font-stretch-normal">
            #{order.id}
          </span>
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <Field label="Cliente">{order.customerName}</Field>
        <Field label="Endereço de entrega">{order.deliveryAddress}</Field>
        <Field label="Criado em">
          <span className="font-mono tabular-nums">
            {formatDateTime(order.createdAt)}
          </span>
        </Field>
        <Field label="Atualizado em">
          <span className="font-mono tabular-nums">
            {formatDateTime(order.updatedAt)}
          </span>
        </Field>
      </dl>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function Items({ order }: { order: OrderDetail }) {
  const total = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Itens</h2>

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 text-right font-medium">Qtd.</th>
              <th className="px-4 py-2 text-right font-medium">Preço unit.</th>
              <th className="px-4 py-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr
                key={item.id}
                className="border-border border-b last:border-0"
              >
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {item.quantity}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border border-t">
              <td className="px-4 py-2 font-medium" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-2 text-right font-mono font-medium tabular-nums">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
