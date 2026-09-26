/** Discover sends a small, opinionated slice of the library instead of every book. */

export const DISCOVERY_BEST_COUNT = 7;
export const DISCOVERY_WORST_COUNT = 3;
export const DISCOVERY_LIMIT = DISCOVERY_BEST_COUNT + DISCOVERY_WORST_COUNT;

type RankedBook = { id: string; rating: number; updatedAt?: string };

function byRatingThenRecent(left: RankedBook, right: RankedBook) {
  return (
    right.rating - left.rating ||
    (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "") ||
    left.id.localeCompare(right.id)
  );
}

/**
 * Picks the books that say the most about taste: the highest rated, plus a few
 * of the lowest rated so the model also learns what to avoid.
 */
export function selectDiscoveryBooks<T extends RankedBook>(
  books: T[],
  limit = DISCOVERY_LIMIT
): T[] {
  if (books.length <= limit) return [...books];

  const rated = books.filter((book) => book.rating > 0).sort(byRatingThenRecent);
  const worstCount = Math.min(
    DISCOVERY_WORST_COUNT,
    Math.max(0, limit - DISCOVERY_BEST_COUNT)
  );
  const picked: T[] = rated.slice(0, Math.min(limit - worstCount, rated.length));
  const chosen = new Set(picked.map((book) => book.id));

  for (let index = rated.length - 1; index >= 0 && picked.length < limit; index -= 1) {
    const book = rated[index];
    if (chosen.has(book.id)) continue;
    chosen.add(book.id);
    picked.push(book);
  }

  const unrated = books
    .filter((book) => !chosen.has(book.id))
    .sort(
      (left, right) =>
        (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "") ||
        left.id.localeCompare(right.id)
    );
  for (const book of unrated) {
    if (picked.length >= limit) break;
    chosen.add(book.id);
    picked.push(book);
  }

  return picked;
}
