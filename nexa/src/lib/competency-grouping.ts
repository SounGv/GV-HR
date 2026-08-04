const UNCATEGORIZED = "__uncategorized";

export interface CategoryGroup<T> {
  categoryId: string;
  categoryName: string;
  items: T[];
}

/**
 * Buckets a flat, already-ordered (by category.order, then item.order) list of
 * competency-like items into category groups, with uncategorized items in a
 * trailing group — used by the competency bank, campaign form, and rating UI
 * so all three render the same Favpo-style "bold header, rated bullets below"
 * layout from one shared function.
 */
export function groupByCategory<
  T extends { categoryId?: string | null; category?: { id: string; name: string } | null },
>(items: T[]): CategoryGroup<T>[] {
  const buckets = new Map<string, CategoryGroup<T>>();

  for (const item of items) {
    const key = item.categoryId ?? UNCATEGORIZED;
    if (!buckets.has(key)) {
      buckets.set(key, {
        categoryId: key,
        categoryName: item.category?.name ?? "ไม่มีหมวดหมู่",
        items: [],
      });
    }
    buckets.get(key)!.items.push(item);
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.categoryId === UNCATEGORIZED) return 1;
    if (b.categoryId === UNCATEGORIZED) return -1;
    return 0;
  });
}
