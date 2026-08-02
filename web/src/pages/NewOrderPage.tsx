import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { createOrder } from "@/api/orders";
import { OrderItemFields } from "@/components/OrderItemFields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useOrderForm,
  type ItemDraft,
  type OrderFormErrors,
} from "@/hooks/useOrderForm";
import { describeError, hasFieldErrors } from "@/lib/errors";
import { itemFieldId, type ItemField } from "@/lib/fieldIds";
import { formatCents } from "@/lib/money";

export function NewOrderPage() {
  const form = useOrderForm();
  const navigate = useNavigate();
  const addRef = useRef<HTMLButtonElement>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  /*
   * Whether this screen is still the one on display. react-router's own guard does not answer that:
   * useNavigate arms its active flag in a layout effect with no cleanup, so it stays armed for the
   * life of the closure and a navigation fired after the screen is gone still goes through.
   */
  const showing = useRef(true);

  useEffect(() => {
    showing.current = true;

    return () => {
      showing.current = false;
    };
  }, []);

  /*
   * A row added or removed takes the control that was pressed with it, or arrives with nothing
   * focused, and either way focus falls back to the body. It goes to the new row's first field on
   * an addition — which is where typing continues — and to the add button on a removal, the one
   * control in the section that is always there.
   */
  function handleAdd() {
    const id = form.addItem();

    requestAnimationFrame(() => {
      document.getElementById(itemFieldId(id, "name"))?.focus();
    });
  }

  function handleRemove(id: string) {
    form.removeItem(id);
    addRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    const { body, errors } = form.validate();

    /*
     * The messages appear under the fields, and on a form this tall the field that broke can be off
     * the bottom of the window — pressing the button would look like it did nothing at all. Focus
     * goes to the first one, which scrolls it into view and reads its message out.
     */
    if (body === null) {
      document.getElementById(firstBroken(form.items, errors) ?? "")?.focus();

      return;
    }

    setPending(true);
    try {
      const created = await createOrder(body);

      /*
       * Only if the form is still on screen. Leaving while the request is in flight — the Cancel
       * link beside the button, the browser's back, anything in the header — is a decision not to
       * be taken to the order, and the order exists either way. Travelling from here anyway would
       * pull the reader off the page they chose, and `replace` would eat the entry they came from.
       */
      if (!showing.current) return;

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

  /*
   * A refusal carried by the fields is only worth stating while the fields are still carrying it.
   * The highlights come off one by one as they are corrected, and this banner used to stay until
   * the next submit, telling the reader to check destaques that were no longer on screen.
   *
   * Refusals with nothing under a field — a 500, a network that never answered — are the whole
   * message, so they stay up regardless.
   */
  const stale = hasFieldErrors(failure) && !form.hasErrors;

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

      {failure !== null && !stale && (
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

/** The order they are read in, so focus lands on the first thing wrong rather than the first found. */
const ITEM_FIELDS: readonly ItemField[] = ["name", "quantity", "unitPrice"];

/** The id of the input to send focus to, or undefined when nothing broke. */
function firstBroken(
  items: ItemDraft[],
  errors: OrderFormErrors,
): string | undefined {
  if (errors.customerName !== undefined) return "customerName";
  if (errors.deliveryAddress !== undefined) return "deliveryAddress";

  for (const item of items) {
    const broken = errors.byItem[item.id];
    if (broken === undefined) continue;

    for (const field of ITEM_FIELDS) {
      if (broken[field] !== undefined) return itemFieldId(item.id, field);
    }
  }

  return undefined;
}
