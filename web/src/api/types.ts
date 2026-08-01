export const ORDER_STATUSES = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  name: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  /** Seconds, not milliseconds: the API sends expiration().toSeconds(). */
  expiresIn: number;
}

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  /** Read back as a JSON number, so "45.90" arrives as 45.9. */
  unitPrice: number;
}

export interface OrderStatusEntry {
  id: number;
  /** Null on the row the order is created with, which has no origin. */
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
  changedBy: string;
}

/** The listing projection: no items and no history, to keep it off the N+1. */
export interface OrderSummary {
  id: number;
  customerName: string;
  deliveryAddress: string;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderDetail {
  id: number;
  customerName: string;
  deliveryAddress: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history: OrderStatusEntry[];
}

export interface CreateOrderItemRequest {
  name: string;
  quantity: number;
  /** Sent as a string so the cents survive the trip as written. */
  unitPrice: string;
}

export interface CreateOrderRequest {
  customerName: string;
  deliveryAddress: string;
  items: CreateOrderItemRequest[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface PageMetadata {
  size: number;
  number: number;
  totalElements: number;
  totalPages: number;
}

export interface Paged<T> {
  content: T[];
  page: PageMetadata;
}

/** Mirrors SORTABLE_PROPERTIES in OrderService; anything else is answered 400. */
export const SORTABLE_ORDER_PROPERTIES = [
  "id",
  "customerName",
  "deliveryAddress",
  "status",
  "createdAt",
] as const;

export type SortableOrderProperty = (typeof SORTABLE_ORDER_PROPERTIES)[number];

/**
 * RFC 9457. Spring omits type when it is the default about:blank, and errors
 * only appears on validation failures, keyed by field with one entry per rule
 * the field broke.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}
