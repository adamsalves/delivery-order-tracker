import type * as React from "react";
import type { OrderStatus } from "@/api/types";
import { cn } from "@/lib/utils";

/** The one-way path. CANCELADO is missing on purpose: it leaves the rail, it is not a step on it. */
const FORWARD: OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
];

const FILL: Record<OrderStatus, string> = {
  RECEBIDO: "bg-status-recebido",
  EM_PREPARO: "bg-status-em-preparo",
  SAIU_PARA_ENTREGA: "bg-status-saiu-para-entrega",
  ENTREGUE: "bg-status-entregue",
  CANCELADO: "bg-status-cancelado",
};

interface StatusRailProps extends React.ComponentProps<"div"> {
  status: OrderStatus;
}

/**
 * Four segments filled up to the current state. A cancelled order does not fill them: the rail is
 * left unfilled and struck through, so the shape says the order stopped rather than finished.
 */
export function StatusRail({ status, className, ...props }: StatusRailProps) {
  const reached = FORWARD.indexOf(status);

  return (
    <div
      className={cn("relative flex items-center gap-1", className)}
      {...props}
    >
      {FORWARD.map((step, index) => (
        <span
          key={step}
          className={cn(
            "h-1.5 flex-1 rounded-[2px]",
            index <= reached ? FILL[status] : "bg-rail-track",
          )}
        />
      ))}

      {status === "CANCELADO" && (
        <span className="bg-status-cancelado absolute left-1/2 h-4 w-[3px] -translate-x-1/2 rotate-[24deg] rounded-full" />
      )}
    </div>
  );
}
