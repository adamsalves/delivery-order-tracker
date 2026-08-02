import { useRef, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { OrderItemFields } from "@/components/OrderItemFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrderForm } from "@/hooks/useOrderForm";
import { formatCents } from "@/lib/money";

export function NewOrderPage() {
  const form = useOrderForm();
  const addRef = useRef<HTMLButtonElement>(null);

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    form.validate();
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

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Cliente</Label>
            <Input
              id="customerName"
              value={form.customerName}
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
                  disabled={false}
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

        <div className="flex items-center gap-3">
          <Button type="submit">Criar pedido</Button>
          <Button variant="ghost" asChild>
            <Link to="/orders">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
