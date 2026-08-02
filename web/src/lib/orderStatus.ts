import type { OrderStatus } from "@/api/types";
import { formatAlternatives } from "@/lib/format";

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

/**
 * Restates a refused transition in the language the rest of the screen speaks. The API answers 409
 * with a sentence in English, and translating it would mean parsing prose; this is built instead
 * from the same two tables the buttons are built from.
 *
 * <p>The status it names has to be read back from the server first. A refusal only happens when the
 * order moved under the screen, so the copy held here is stale by definition — it is the one thing
 * this module cannot supply.
 */
export function describeRefusal(current: OrderStatus): string {
  const here = `O pedido está em «${STATUS_LABELS[current]}»`;

  if (isTerminal(current)) {
    return `${here}, que encerra o pedido e não admite outra mudança.`;
  }

  const open = allowedTransitions(current).map(
    (status) => `«${STATUS_LABELS[status]}»`,
  );

  return `${here}. Daqui ele só pode ir para ${formatAlternatives(open)}.`;
}
