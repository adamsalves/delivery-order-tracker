import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemDraft, ItemErrors } from "@/hooks/useOrderForm";
import { itemFieldId } from "@/lib/fieldIds";

interface OrderItemFieldsProps {
  item: ItemDraft;
  position: number;
  errors: ItemErrors;
  disabled: boolean;
  /** False on the last row, which the API refuses to be without. */
  removable: boolean;
  onChange: (patch: Partial<Omit<ItemDraft, "id">>) => void;
  onRemove: () => void;
}

/**
 * One line of the order. The ids that tie each label to its input are built from the row's own id
 * rather than its position, so removing a row cannot leave a label pointing at another row's field.
 */
export function OrderItemFields({
  item,
  position,
  errors,
  disabled,
  removable,
  onChange,
  onRemove,
}: OrderItemFieldsProps) {
  const at = (field: keyof ItemErrors) => itemFieldId(item.id, field);

  /*
   * The row is named as a group, because the three labels inside it repeat identically down the
   * list: without that a screen reader announces "Item, Qtd., Preço unit." over and over with
   * nothing saying which line is being read. Only the remove button carried the position before.
   */
  return (
    <li
      role="group"
      aria-label={`Item ${position}`}
      className="border-border grid gap-3 border-b px-4 py-4 last:border-0 sm:grid-cols-[1fr_6rem_8rem_auto] sm:items-start"
    >
      <Field id={at("name")} label="Item" error={errors.name}>
        <Input
          id={at("name")}
          value={item.name}
          disabled={disabled}
          autoComplete="off"
          placeholder="Pizza margherita"
          onChange={(event) => onChange({ name: event.target.value })}
          aria-invalid={errors.name !== undefined}
          aria-describedby={errors.name && `${at("name")}-error`}
        />
      </Field>

      {/*
       * Text with a numeric keypad rather than type="number": that one accepts "e" and a sign as
       * well as digits, and turns a scroll over a focused field into a change of quantity.
       */}
      <Field id={at("quantity")} label="Qtd." error={errors.quantity}>
        <Input
          id={at("quantity")}
          inputMode="numeric"
          value={item.quantity}
          disabled={disabled}
          className="text-right font-mono tabular-nums"
          onChange={(event) => onChange({ quantity: event.target.value })}
          aria-invalid={errors.quantity !== undefined}
          aria-describedby={errors.quantity && `${at("quantity")}-error`}
        />
      </Field>

      <Field id={at("unitPrice")} label="Preço unit." error={errors.unitPrice}>
        <Input
          id={at("unitPrice")}
          inputMode="decimal"
          value={item.unitPrice}
          disabled={disabled}
          placeholder="45,90"
          className="text-right font-mono tabular-nums"
          onChange={(event) => onChange({ unitPrice: event.target.value })}
          aria-invalid={errors.unitPrice !== undefined}
          aria-describedby={errors.unitPrice && `${at("unitPrice")}-error`}
        />
      </Field>

      <div className="flex justify-end sm:pt-6">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || !removable}
          onClick={onRemove}
          aria-label={`Remover item ${position}`}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-muted-foreground mb-1.5 text-xs">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-destructive mt-1 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
