import type { SortableOrderProperty } from "@/api/types";

export interface OrderSort {
  label: string;
  property: SortableOrderProperty;
  direction: "asc" | "desc";
}

/**
 * Property and direction are offered as ready-made pairs rather than as two controls. One choice
 * then has one meaning, where a column button that also toggles its own direction does something
 * different depending on whether it was already the active one, and the label can say what the
 * list will look like instead of naming the column it sorts on.
 *
 * <p>Two of the properties the API accepts are left out on purpose. Ordering by `id` is ordering by
 * creation, which the first two entries already say, and it goes on the request as the tie-breaker
 * either way. `status` is mapped with EnumType.STRING, so the database orders it alphabetically —
 * CANCELADO, EM_PREPARO, ENTREGUE, RECEBIDO, SAIU_PARA_ENTREGA — which is not the order the rail
 * draws and would read as broken.
 */
export const ORDER_SORT_IDS = [
  "newest",
  "oldest",
  "customer-az",
  "customer-za",
  "address-az",
  "address-za",
] as const;

export type OrderSortId = (typeof ORDER_SORT_IDS)[number];

export const ORDER_SORTS: Record<OrderSortId, OrderSort> = {
  newest: { label: "Mais recentes", property: "createdAt", direction: "desc" },
  oldest: { label: "Mais antigos", property: "createdAt", direction: "asc" },
  "customer-az": {
    label: "Cliente A–Z",
    property: "customerName",
    direction: "asc",
  },
  "customer-za": {
    label: "Cliente Z–A",
    property: "customerName",
    direction: "desc",
  },
  "address-az": {
    label: "Endereço A–Z",
    property: "deliveryAddress",
    direction: "asc",
  },
  "address-za": {
    label: "Endereço Z–A",
    property: "deliveryAddress",
    direction: "desc",
  },
};

/**
 * The same order @PageableDefault already applies on OrderController, so the first read asks for
 * what it would have been given anyway and the control opens naming it.
 */
export const DEFAULT_ORDER_SORT: OrderSortId = "newest";

/** The listbox hands its value back as a plain string; this is where it becomes one of ours. */
export function isOrderSortId(value: string): value is OrderSortId {
  return value in ORDER_SORTS;
}
