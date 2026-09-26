import type { Book, BookInput, OpenLibraryBook } from "@/types/book";

export type CleanupAction = {
  id: string;
  bookId: string;
  title: string;
  kind: "update" | "remove";
  summary: string;
  patch?: Partial<BookInput>;
};

export function bookMatchKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function coverIdFromStoredUrl(url: string) {
  const match = /\/b\/id\/(\d+)/.exec(url);
  return match ? Number(match[1]) : null;
}

function titlesMatch(left: string, right: string) {
  const a = bookMatchKey(left);
  const b = bookMatchKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 8 && (longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`));
}

function authorsMatch(left: string, right: string) {
  const a = bookMatchKey(left);
  const b = bookMatchKey(right);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

function richness(book: Book) {
  let score = 0;
  if (book.coverId) score += 8;
  if (book.isbn) score += 4;
  if (book.openLibraryId) score += 2;
  if (book.rating) score += 2;
  if (book.notes.trim()) score += 3;
  if (book.tags.length) score += 2;
  if (book.pageCount) score += 1;
  if (book.journal.coverUrl) score += 1;
  if (book.journal.description) score += 1;
  return score;
}

function firstText(books: Book[], read: (book: Book) => string) {
  return books.map(read).find((value) => value.trim()) ?? "";
}

function mergeMissing(keeper: Book, others: Book[]): Partial<BookInput> | null {
  const sources = [keeper, ...others];
  const patch: Partial<BookInput> = {};
  const coverId =
    keeper.coverId ??
    sources.find((book) => book.coverId)?.coverId ??
    sources.map((book) => coverIdFromStoredUrl(book.journal.coverUrl)).find((id) => id) ??
    null;
  if (!keeper.coverId && coverId) patch.coverId = coverId;
  if (!keeper.isbn) {
    const isbn = firstText(sources, (book) => book.isbn);
    if (isbn) patch.isbn = isbn;
  }
  if (!keeper.openLibraryId) {
    const openLibraryId = firstText(sources, (book) => book.openLibraryId);
    if (openLibraryId) patch.openLibraryId = openLibraryId;
  }
  if (!keeper.pageCount) {
    const pageCount = sources.find((book) => book.pageCount)?.pageCount;
    if (pageCount) patch.pageCount = pageCount;
  }
  if (!keeper.rating) {
    const rating = sources.find((book) => book.rating)?.rating;
    if (rating) patch.rating = rating;
  }
  if (!keeper.notes.trim()) {
    const notes = firstText(others, (book) => book.notes);
    if (notes) patch.notes = notes;
  }
  if (!keeper.tags.length) {
    const tags = sources.find((book) => book.tags.length)?.tags;
    if (tags) patch.tags = tags;
  }
  const journal = { ...keeper.journal };
  let journalChanged = false;
  for (const key of [
    "description",
    "favoriteCharacter",
    "sceneSummary",
    "memorableMoments",
    "leastFavoritePart",
    "genre",
    "coverUrl",
  ] as const) {
    if (!journal[key].trim()) {
      const value = firstText(others, (book) => book.journal[key]);
      if (value) {
        journal[key] = value;
        journalChanged = true;
      }
    }
  }
  if (journalChanged) patch.journal = journal;
  return Object.keys(patch).length ? patch : null;
}

function summaryFor(patch: Partial<BookInput>, copies: number) {
  const bits = [
    patch.coverId ? "cover" : "",
    patch.isbn ? "ISBN" : "",
    patch.notes ? "notes" : "",
    patch.rating ? "rating" : "",
    patch.tags ? "tags" : "",
    patch.pageCount ? "page count" : "",
    patch.journal ? "review details" : "",
  ].filter(Boolean);
  const filled = bits.length ? `Fill ${bits.join(", ")}` : "Keep this copy";
  return copies ? `${filled} from ${copies} other ${copies === 1 ? "copy" : "copies"}.` : `${filled}.`;
}

export function planLibraryCleanup(books: Book[]): CleanupAction[] {
  const groups = new Map<string, Book[]>();
  for (const book of books) {
    const title = bookMatchKey(book.title);
    if (!title) continue;
    const key = `${title}|${bookMatchKey(book.author)}`;
    groups.set(key, [...(groups.get(key) ?? []), book]);
  }
  const actions: CleanupAction[] = [];
  const handled = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort(
      (left, right) => richness(right) - richness(left) || left.createdAt.localeCompare(right.createdAt),
    );
    const [keeper, ...rest] = ranked;
    const patch = mergeMissing(keeper, rest);
    if (patch) {
      actions.push({
        id: `update:${keeper.id}`,
        bookId: keeper.id,
        title: keeper.title,
        kind: "update",
        summary: summaryFor(patch, rest.length),
        patch,
      });
    }
    for (const extra of rest) {
      actions.push({
        id: `remove:${extra.id}`,
        bookId: extra.id,
        title: extra.title,
        kind: "remove",
        summary: `Duplicate of ${keeper.title}. This copy will be removed.`,
      });
      handled.add(extra.id);
    }
    handled.add(keeper.id);
  }
  for (const book of books) {
    if (handled.has(book.id) || book.coverId) continue;
    const coverId = coverIdFromStoredUrl(book.journal.coverUrl);
    if (!coverId) continue;
    actions.push({
      id: `cover:${book.id}`,
      bookId: book.id,
      title: book.title,
      kind: "update",
      summary: "Use the saved cover link.",
      patch: { coverId },
    });
  }
  return actions;
}

export function coverPatchFromSearch(book: Book, results: OpenLibraryBook[]): Partial<BookInput> | null {
  const matches = results.filter(
    (result) => titlesMatch(book.title, result.title) && authorsMatch(book.author, result.author),
  );
  const best = matches.find((result) => result.coverId) ?? matches[0];
  if (!best) return null;
  const patch: Partial<BookInput> = {};
  if (!book.coverId && best.coverId) patch.coverId = best.coverId;
  if (!book.isbn && best.isbn) patch.isbn = best.isbn;
  if (!book.openLibraryId && best.openLibraryId) patch.openLibraryId = best.openLibraryId;
  if (!book.pageCount && best.pageCount) patch.pageCount = best.pageCount;
  if (!book.tags.length && best.subjects.length) patch.tags = best.subjects.slice(0, 6);
  return Object.keys(patch).length ? patch : null;
}
