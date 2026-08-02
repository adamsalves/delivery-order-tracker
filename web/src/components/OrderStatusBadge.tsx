import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { OrderStatus } from "@/api/types";
import { STATUS_LABELS } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

/**
 * The status colours are the only saturated thing on the page, and each one was picked to clear
 * 4.5:1 against the surface. They carry the text here rather than filling the pill, so the status
 * stays legible instead of relying on a swatch nobody can name out loud.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.6875rem] leading-4 font-medium tracking-wide uppercase",
  {
    variants: {
      status: {
        RECEBIDO:
          "border-status-recebido/25 bg-status-recebido/10 text-status-recebido",
        EM_PREPARO:
          "border-status-em-preparo/25 bg-status-em-preparo/10 text-status-em-preparo",
        SAIU_PARA_ENTREGA:
          "border-status-saiu-para-entrega/25 bg-status-saiu-para-entrega/10 text-status-saiu-para-entrega",
        ENTREGUE:
          "border-status-entregue/25 bg-status-entregue/10 text-status-entregue",
        CANCELADO:
          "border-status-cancelado/25 bg-status-cancelado/10 text-status-cancelado",
      } satisfies Record<OrderStatus, string>,
    },
  },
);

interface OrderStatusBadgeProps
  extends
    Omit<React.ComponentProps<"span">, "children">,
    Required<VariantProps<typeof badgeVariants>> {
  status: OrderStatus;
}

export function OrderStatusBadge({
  status,
  className,
  ...props
}: OrderStatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ status }), className)} {...props}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
