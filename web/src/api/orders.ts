import { request } from "./client";
import type {
  CreateOrderRequest,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Paged,
  SortableOrderProperty,
} from "./types";

export interface ListOrdersParams {
  page?: number;
  size?: number;
  sort?: SortableOrderProperty;
  direction?: "asc" | "desc";
  signal?: AbortSignal;
}

export function listOrders({
  page,
  size,
  sort,
  direction = "desc",
  signal,
}: ListOrdersParams = {}) {
  const query = new URLSearchParams();

  if (page !== undefined) query.set("page", String(page));
  if (size !== undefined) query.set("size", String(size));

  /*
   * A sort of our own replaces the controller's default outright, including the id it breaks ties
   * with. Without carrying that tie-breaker over, two orders sharing a value can swap places
   * between requests and appear on two pages or on none.
   */
  if (sort !== undefined) {
    query.append("sort", `${sort},${direction}`);
    if (sort !== "id") query.append("sort", `id,${direction}`);
  }

  const suffix = query.size > 0 ? `?${query}` : "";

  return request<Paged<OrderSummary>>(`/api/orders${suffix}`, {
    auth: true,
    signal,
  });
}

export function getOrder(id: number, signal?: AbortSignal) {
  return request<OrderDetail>(`/api/orders/${id}`, { auth: true, signal });
}

export function createOrder(body: CreateOrderRequest) {
  return request<OrderDetail>("/api/orders", {
    method: "POST",
    body,
    auth: true,
  });
}

export function updateOrderStatus(id: number, status: OrderStatus) {
  return request<OrderDetail>(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: { status },
    auth: true,
  });
}
