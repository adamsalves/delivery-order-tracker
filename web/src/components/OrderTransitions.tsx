import { useState } from "react";
import { Loader2 } from "lucide-react";
import { updateOrderStatus } from "@/api/orders";
import type { OrderDetail, OrderStatus } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/errors";
import { allowedTransitions, TRANSITION_LABELS } from "@/lib/orderStatus";

interface OrderTransitionsProps {
  order: OrderDetail;
  onMoved: (updated: OrderDetail) => void;
}

/**
 * Offers only the transitions open from the current status, which is a convenience and not a rule:
 * the same table lives on the server, and it is the one that decides. A refusal is shown as it came
 * back, since its message names the transitions actually open.
 */
export function OrderTransitions({ order, onMoved }: OrderTransitionsProps) {
  const [moving, setMoving] = useState<OrderStatus | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  const open = allowedTransitions(order.status);

  /* ENTREGUE and CANCELADO allow nothing further, so there is no control to show. */
  if (open.length === 0) return null;

  async function move(target: OrderStatus) {
    setMoving(target);
    setFailure(null);

    try {
      /*
       * The reply is the whole order, history included, so it becomes the new state directly.
       * Reading it back with a second request would only fetch what is already in hand.
       */
      onMoved(await updateOrderStatus(order.id, target));
    } catch (error) {
      setFailure(error);
    } finally {
      setMoving(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">Próximo passo</h2>

      {failure !== null && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(failure)}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {open.map((target) => (
          <Button
            key={target}
            variant={target === "CANCELADO" ? "destructive" : "default"}
            disabled={moving !== null}
            onClick={() => void move(target)}
          >
            {moving === target && <Loader2 className="animate-spin" />}
            {TRANSITION_LABELS[target]}
          </Button>
        ))}
      </div>
    </section>
  );
}
