import type { SelectItem } from "./types.js";

/** Turns the `'label'` shorthand into `{ label, value }` items */
export function normalizeItems<T>(
  items: Array<SelectItem<T> | T>,
): SelectItem<T>[] {
  return items.map((item) =>
    typeof item === "string"
      ? { label: item, value: item as T }
      : (item as SelectItem<T>),
  );
}
