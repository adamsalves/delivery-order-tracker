/** The fields of one item line, in the order they are read on screen. */
export type ItemField = "name" | "quantity" | "unitPrice";

/**
 * The one place the ids of an item's inputs are spelled. The row component builds its labels from
 * this and the screen sends focus with it — to the field that broke, to the row it just added — and
 * two copies of the convention would let one drift into pointing at nothing.
 *
 * <p>Keyed by the row's own id and never by its position, so removing a row cannot leave a label
 * tied to a field that now belongs to another row.
 */
export function itemFieldId(itemId: string, field: ItemField): string {
  return `item-${itemId}-${field}`;
}
