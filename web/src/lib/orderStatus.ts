import type { OrderStatus } from "@/api/types";

/**
 * The one-way path. CANCELADO is missing on purpose: it leaves the path, it is not a step on it.
 */
export const FORWARD_STATUSES: readonly OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
];

/** The enum values are Portuguese by requirement; these are the same values made readable. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEBIDO: "Recebido",
  EM_PREPARO: "Em preparo",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

/** What the action does, rather than what it lands on, since it labels a button. */
export const TRANSITION_LABELS: Record<OrderStatus, string> = {
  RECEBIDO: "Receber",
  EM_PREPARO: "Iniciar preparo",
  SAIU_PARA_ENTREGA: "Despachar para entrega",
  ENTREGUE: "Confirmar entrega",
  CANCELADO: "Cancelar pedido",
};

/**
 * Mirrors OrderStatus.allowedTransitions() on the API. Kept as a convenience so the screen only
 * offers what will be accepted — the server stays the authority and answers 409 either way.
 *
 * No status lists itself, so standing still is refused by the same table that refuses a jump.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEBIDO: ["EM_PREPARO", "CANCELADO"],
  EM_PREPARO: ["SAIU_PARA_ENTREGA", "CANCELADO"],
  SAIU_PARA_ENTREGA: ["ENTREGUE", "CANCELADO"],
  ENTREGUE: [],
  CANCELADO: [],
};

export function allowedTransitions(
  status: OrderStatus,
): readonly OrderStatus[] {
  return TRANSITIONS[status];
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
