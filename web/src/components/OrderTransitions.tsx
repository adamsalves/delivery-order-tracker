import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/api/client";
import { getOrder, updateOrderStatus } from "@/api/orders";
import type { OrderDetail, OrderStatus } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/errors";
import {
  allowedTransitions,
  describeRefusal,
  isTerminal,
  TRANSITION_LABELS,
} from "@/lib/orderStatus";

const GONE = { 404: "Este pedido não existe mais." };

interface OrderTransitionsProps {
  order: OrderDetail;
  onMoved: (updated: OrderDetail) => void;
}

/**
 * Offers only the transitions open from the current status, which is a convenience and not a rule:
 * the same table lives on the server, and it is the one that decides.
 */
export function OrderTransitions({ order, onMoved }: OrderTransitionsProps) {
  const [moving, setMoving] = useState<OrderStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /*
   * ENTREGUE and CANCELADO allow nothing further, so there is no control to show — but the section
   * stays while a refusal is up, because reaching a terminal status is often the refusal itself and
   * leaving would take the explanation with it.
   */
  if (isTerminal(order.status) && failure === null) return null;

  const open = allowedTransitions(order.status);

  async function move(target: OrderStatus) {
    /* What makes aria-disabled enough below: the repeat press is refused here rather than by an
     * attribute, so the button can stay reachable while it says it is busy. */
    if (moving !== null) return;

    setMoving(target);
    setFailure(null);

    try {
      /*
       * The reply is the whole order, history included, so it becomes the new state directly.
       * Reading it back with a second request would only fetch what is already in hand.
       */
      onMoved(await updateOrderStatus(order.id, target));
    } catch (error) {
      setFailure(await explain(order.id, error, onMoved));
    } finally {
      setMoving(null);
    }
  }

  return (
    <section className="space-y-3">
      {open.length > 0 && (
        <h2 className="font-display text-lg font-semibold">Próximo passo</h2>
      )}

      {failure !== null && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {open.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {/* aria-disabled and not disabled, the same choice "Carregar mais" makes on the listing:
              move() already refuses a repeat, and taking the attribute route would drop the focus
              instead of only announcing the wait. It costs nothing on the success path, where these
              buttons are replaced — but a refused transition re-enables them, and the focus would be
              gone at the exact moment there is something to read. */}
          {open.map((target) => (
            <Button
              key={target}
              variant={target === "CANCELADO" ? "destructive" : "default"}
              aria-disabled={moving !== null}
              onClick={() => void move(target)}
            >
              {moving === target && <Loader2 className="animate-spin" />}
              {TRANSITION_LABELS[target]}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A 409 says the order moved while the screen was holding an older copy of it, so the order is read
 * back before anything is said: the screen catches up to where it actually is, and the refusal can
 * name that status in the language of the rest of the page rather than quoting the API's English.
 *
 * <p>Only the refusal pays for that read. An accepted transition still answers with the order
 * itself, and adds no request.
 */
async function explain(
  id: number,
  error: unknown,
  onMoved: (updated: OrderDetail) => void,
): Promise<string> {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return describeError(error, GONE);
  }

  try {
    const fresh = await getOrder(id);
    onMoved(fresh);

    return describeRefusal(fresh.status);
  } catch {
    /* Nothing left to say it with but the sentence the API already sent. */
    return describeError(error);
  }
}
