import { useCallback, useMemo, useState } from "react";
import type { CreateOrderItemRequest, CreateOrderRequest } from "@/api/types";
import { fieldErrorOf } from "@/lib/errors";
import { readAmount, type AmountProblem } from "@/lib/money";

/** Mirrors @Size(max = 255) on the three text fields of the create request. */
const MAX_TEXT_LENGTH = 255;

/** The column is an int and the constraint is @Positive, so the ceiling is Java's own. */
const MAX_QUANTITY = 2_147_483_647;

const COUNTED = /^\d+$/;

const PRICE_PROBLEMS: Record<AmountProblem, string> = {
  missing: "Informe o preço.",
  malformed: "Use apenas números e uma vírgula, como 45,90.",
  grouped: "Não separe o milhar: escreva 1234,00.",
  notPositive: "O preço precisa ser maior que zero.",
  tooLarge: "Preço alto demais.",
  tooPrecise: "No máximo duas casas decimais.",
};

/**
 * Every field is held as text, including the two that are numbers. An input the user has emptied
 * has no number to hold, and storing one anyway would either refuse the backspace or put a 0 back
 * under the cursor.
 *
 * <p>The id is generated here and never sent: it exists to key the list. Keying by array position
 * instead would hand the inputs of a removed row to the row that took its place, since React
 * matches by key and the values live in the DOM.
 */
export interface ItemDraft {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

export interface ItemErrors {
  name?: string;
  quantity?: string;
  unitPrice?: string;
}

/**
 * One shape for both origins. What the client refused and what the server refused render through
 * the same path, so a field cannot be highlighted one way by one and another way by the other.
 */
export interface OrderFormErrors {
  customerName?: string;
  deliveryAddress?: string;
  items?: string;
  byItem: Record<string, ItemErrors>;
}

export interface OrderForm {
  customerName: string;
  deliveryAddress: string;
  items: ItemDraft[];
  errors: OrderFormErrors;
  /** Whether anything is still highlighted, which is what a banner about the fields outlives. */
  hasErrors: boolean;
  totalCents: number;
  /** False on the last row: the API answers @NotEmpty, and an order with no items is not one. */
  canRemove: boolean;
  setCustomerName: (value: string) => void;
  setDeliveryAddress: (value: string) => void;
  addItem: () => string;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<Omit<ItemDraft, "id">>) => void;
  /** The body to send, or null; either way the errors it found come back with it. */
  validate: () => Validation;
  applyServerErrors: (error: unknown) => void;
}

/**
 * The errors travel back rather than only into state, because the caller has to act on them in the
 * same tick — moving the focus to what broke — and a setState is not readable that soon. Which
 * element that is stays the screen's business: this side names the field, not the input.
 */
export interface Validation {
  body: CreateOrderRequest | null;
  errors: OrderFormErrors;
}

function emptyItem(): ItemDraft {
  return { id: crypto.randomUUID(), name: "", quantity: "1", unitPrice: "" };
}

export function useOrderForm(): OrderForm {
  const [customerName, setWrittenName] = useState("");
  const [deliveryAddress, setWrittenAddress] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(() => [emptyItem()]);
  const [errors, setErrors] = useState<OrderFormErrors>({ byItem: {} });

  /*
   * Editing a field withdraws what was said about it, the same way editing a row does. A message
   * describes the value that was refused, and the field no longer holds that value — leaving it up
   * would mark a field as bad while the user looks at the correction they just typed into it.
   */
  const setCustomerName = useCallback((value: string) => {
    setWrittenName(value);
    setErrors((held) => withoutField(held, "customerName"));
  }, []);

  const setDeliveryAddress = useCallback((value: string) => {
    setWrittenAddress(value);
    setErrors((held) => withoutField(held, "deliveryAddress"));
  }, []);

  const addItem = useCallback(() => {
    const item = emptyItem();
    setItems((held) => held.concat(item));

    return item.id;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((held) =>
      held.length > 1 ? held.filter((i) => i.id !== id) : held,
    );
    setErrors((held) => withoutItem(held, id));
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<ItemDraft, "id">>) => {
      setItems((held) =>
        held.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );

      /*
       * The messages under a row describe the value that was refused, and the row no longer holds
       * it. Clearing the whole row rather than the edited field keeps the price and the quantity
       * from disagreeing about which of them the total is wrong about.
       */
      setErrors((held) => withoutItem(held, id));
    },
    [],
  );

  /*
   * Counted through the same checks the submit runs, and not a looser copy of them. Reading the
   * quantity raw here while checkQuantity trimmed it meant " 2" was sent but left out of the total,
   * so the figure on screen disagreed with the order that was placed.
   *
   * A line still being typed contributes nothing rather than poisoning the sum with NaN.
   */
  const totalCents = useMemo(
    () =>
      items.reduce((sum, item) => {
        const price = readAmount(item.unitPrice);
        if (!price.valid || checkQuantity(item.quantity) !== undefined) {
          return sum;
        }

        return sum + price.cents * Number(item.quantity.trim());
      }, 0),
    [items],
  );

  const validate = useCallback((): Validation => {
    const found: OrderFormErrors = { byItem: {} };

    found.customerName = checkText(customerName, "Informe o cliente.");
    found.deliveryAddress = checkText(
      deliveryAddress,
      "Informe o endereço de entrega.",
    );

    /*
     * Checking a row and converting it are one act, so the price that passed is the price that is
     * sent. Reading it a second time to build the body would mean claiming to the compiler that it
     * parses, and a claim is what the rest of this codebase declines to make about a value.
     */
    const sending: CreateOrderItemRequest[] = [];

    for (const item of items) {
      const checked = checkItem(item);

      if (checked.ready === undefined) found.byItem[item.id] = checked.errors;
      else sending.push(checked.ready);
    }

    setErrors(found);

    if (broken(found)) return { body: null, errors: found };

    return {
      body: {
        customerName: customerName.trim(),
        deliveryAddress: deliveryAddress.trim(),
        items: sending,
      },
      errors: found,
    };
  }, [customerName, deliveryAddress, items]);

  /**
   * Turns the API's field keys into this form's. Spring names a nested violation by its position in
   * the list it arrived in — items[0].unitPrice — and the rows here are keyed by an id the server
   * never saw, so the two are matched by that position.
   *
   * <p>Sound because the form is disabled while the request is in flight: the array read here is
   * the array that was sent. What comes after is an edit, and an edit clears the row's messages.
   */
  const applyServerErrors = useCallback(
    (error: unknown) => {
      const found: OrderFormErrors = {
        customerName: fieldErrorOf(error, "customerName"),
        deliveryAddress: fieldErrorOf(error, "deliveryAddress"),
        items: fieldErrorOf(error, "items"),
        byItem: {},
      };

      items.forEach((item, index) => {
        const itemErrors: ItemErrors = {
          name: fieldErrorOf(error, `items[${index}].name`),
          quantity: fieldErrorOf(error, `items[${index}].quantity`),
          unitPrice: fieldErrorOf(error, `items[${index}].unitPrice`),
        };

        if (stated(itemErrors)) found.byItem[item.id] = itemErrors;
      });

      setErrors(found);
    },
    [items],
  );

  return {
    customerName,
    deliveryAddress,
    items,
    errors,
    hasErrors: broken(errors),
    totalCents,
    canRemove: items.length > 1,
    setCustomerName,
    setDeliveryAddress,
    addItem,
    removeItem,
    updateItem,
    validate,
    applyServerErrors,
  };
}

function checkText(value: string, missing: string): string | undefined {
  const written = value.trim();

  if (written === "") return missing;
  if (written.length > MAX_TEXT_LENGTH) {
    return `No máximo ${MAX_TEXT_LENGTH} caracteres.`;
  }

  return undefined;
}

/** Either the line the API is sent, or the reasons it is not being sent one. Never both. */
interface CheckedItem {
  errors: ItemErrors;
  ready?: CreateOrderItemRequest;
}

function checkItem(item: ItemDraft): CheckedItem {
  const price = readAmount(item.unitPrice);
  const errors: ItemErrors = {
    name: checkText(item.name, "Informe o item."),
    quantity: checkQuantity(item.quantity),
    unitPrice: price.valid ? undefined : PRICE_PROBLEMS[price.problem],
  };

  if (stated(errors) || !price.valid) return { errors };

  return {
    errors,
    ready: {
      name: item.name.trim(),
      quantity: Number(item.quantity),
      unitPrice: price.text,
    },
  };
}

function checkQuantity(value: string): string | undefined {
  const written = value.trim();

  if (written === "") return "Informe a quantidade.";
  if (!COUNTED.test(written)) return "Use apenas números inteiros.";

  const counted = Number(written);

  if (counted === 0) return "A quantidade precisa ser maior que zero.";
  if (counted > MAX_QUANTITY) return "Quantidade alta demais.";

  return undefined;
}

function stated(errors: ItemErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined);
}

function broken(errors: OrderFormErrors): boolean {
  return (
    errors.customerName !== undefined ||
    errors.deliveryAddress !== undefined ||
    errors.items !== undefined ||
    Object.keys(errors.byItem).length > 0
  );
}

/** Both of these answer the held object untouched when there is nothing to withdraw, so typing
 * into a field that was never refused does not re-render the form on every keystroke. */
function withoutField(
  errors: OrderFormErrors,
  field: "customerName" | "deliveryAddress",
): OrderFormErrors {
  if (errors[field] === undefined) return errors;

  return { ...errors, [field]: undefined };
}

function withoutItem(errors: OrderFormErrors, id: string): OrderFormErrors {
  if (errors.byItem[id] === undefined) return errors;

  const { [id]: _removed, ...rest } = errors.byItem;

  return { ...errors, byItem: rest };
}
