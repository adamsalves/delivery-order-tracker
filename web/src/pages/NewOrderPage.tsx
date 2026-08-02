import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { createOrder } from "@/api/orders";
import { OrderItemFields } from "@/components/OrderItemFields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrderForm } from "@/hooks/useOrderForm";
import { describeError } from "@/lib/errors";
import { formatCents } from "@/lib/money";

export function NewOrderPage() {
  const form = useOrderForm();
  const navigate = useNavigate();
  const addRef = useRef<HTMLButtonElement>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  /*
   * A row added or removed takes the control that was pressed with it, or arrives with nothing
   * focused, and either way focus falls back to the body. It goes to the new row's first field on
   * an addition — which is where typing continues — and to the add button on a removal, the one
   * control in the section that is always there.
   */
  function handleAdd() {
    const id = form.addItem();

    requestAnimationFrame(() => {
      document.getElementById(`item-${id}-name`)?.focus();
    });
  }

  function handleRemove(id: string) {
    form.removeItem(id);
    addRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    const body = form.validate();
    if (body === null) return;

    setPending(true);
    try {
      const created = await createOrder(body);

      /*
       * Replaced rather than pushed: the form has been spent, and going back to it would offer a
       * filled-in copy of an order that already exists. Back goes to the listing, which now has it.
       */
      void navigate(`/orders/${created.id}`, { replace: true });
    } catch (error) {
      setFailure(error);

      /*
       * The server checks the same rules the form does, so a refusal here is either a rule the
       * client does not know or a body it built wrong. Either way it is said under the field it
       * belongs to, and the alert above only says to look there.
       */
      form.applyServerErrors(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <Link
        to="/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Pedidos
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold font-stretch-110%">
          Novo pedido
        </h1>
        <p className="text-muted-foreground text-sm">
          O pedido entra como «Recebido»; o andamento é dado depois, na tela do
          pedido.
        </p>
      </header>

      {failure !== null && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(failure)}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Cliente</Label>
            <Input
              id="customerName"
              value={form.customerName}
              disabled={pending}
              onChange={(event) => form.setCustomerName(event.target.value)}
              aria-invalid={form.errors.customerName !== undefined}
              aria-describedby={
                form.errors.customerName && "customerName-error"
              }
            />
            {form.errors.customerName && (
              <p id="customerName-error" className="text-destructive text-sm">
                {form.errors.customerName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryAddress">Endereço de entrega</Label>
            <Input
              id="deliveryAddress"
              value={form.deliveryAddress}
              disabled={pending}
              onChange={(event) => form.setDeliveryAddress(event.target.value)}
              aria-invalid={form.errors.deliveryAddress !== undefined}
              aria-describedby={
                form.errors.deliveryAddress && "deliveryAddress-error"
              }
            />
            {form.errors.deliveryAddress && (
              <p
                id="deliveryAddress-error"
                className="text-destructive text-sm"
              >
                {form.errors.deliveryAddress}
              </p>
            )}
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Itens</h2>

          {form.errors.items && (
            <p className="text-destructive text-sm">{form.errors.items}</p>
          )}

          <div className="border-border bg-card overflow-hidden rounded-lg border">
            <ul>
              {form.items.map((item, index) => (
                <OrderItemFields
                  key={item.id}
                  item={item}
                  position={index + 1}
                  errors={form.errors.byItem[item.id] ?? {}}
                  disabled={pending}
                  removable={form.canRemove}
                  onChange={(patch) => form.updateItem(item.id, patch)}
                  onRemove={() => handleRemove(item.id)}
                />
              ))}
            </ul>

            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <Button
                ref={addRef}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={handleAdd}
              >
                <Plus />
                Adicionar item
              </Button>

              {/* A convenience, and only that: the server prices the order from the items it gets. */}
              <p className="text-sm">
                <span className="text-muted-foreground">Total </span>
                <span className="font-mono font-medium tabular-nums">
                  {formatCents(form.totalCents)}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Disabled while the request is in flight, so a second press cannot place a second order. */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Criando pedido…" : "Criar pedido"}
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/orders">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
