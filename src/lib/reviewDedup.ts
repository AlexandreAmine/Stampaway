/**
 * Given multiple reviews (potentially for the same place or by the same user),
 * picks the "newest" one per group key.
 *
 * "Newest" = highest visit_year/visit_month. If all dates are null,
 * falls back to most recent created_at.
 */

export interface ReviewLike {
  visit_year?: number | null;
  visit_month?: number | null;
  created_at: string;
  [key: string]: any;
}

function compareByNewestDate(a: ReviewLike, b: ReviewLike): number {
  const aHasDate = a.visit_year != null;
  const bHasDate = b.visit_year != null;

  // Entries with dates come before entries without
  if (aHasDate && !bHasDate) return -1;
  if (!aHasDate && bHasDate) return 1;

  if (aHasDate && bHasDate) {
    if (a.visit_year! !== b.visit_year!) return b.visit_year! - a.visit_year!;
    const am = a.visit_month ?? 0;
    const bm = b.visit_month ?? 0;
    if (bm !== am) return bm - am;
  }

  // Both have no date or same date — use created_at
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/**
 * Deduplicate reviews by a key (e.g. place_id or user_id).
 * Keeps the entry with the newest visit date per key.
 */
export function dedupeByNewest<T extends ReviewLike>(
  items: T[],
  keyFn: (item: T) => string
): T[] {
  const map = new Map<string, T>();
  // Sort all items by newest first, then iterate
  const sorted = [...items].sort(compareByNewestDate);
  for (const item of sorted) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}
