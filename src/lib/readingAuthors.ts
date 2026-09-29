type ReadingBook = {
  author: string;
  status: string;
  rating: number;
};

export type ReadingAuthor = {
  name: string;
  books: number;
};

/** Authors from books the reader has read or is reading, most-read first. */
export function readingAuthors(books: ReadingBook[]): ReadingAuthor[] {
  const active = books.filter(
    (book) => book.status === "read" || book.status === "reading"
  );
  const source = active.length ? active : books;
  const counts = new Map<string, ReadingAuthor & { score: number }>();

  for (const book of source) {
    const name = book.author.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    const current = counts.get(key) ?? { name, books: 0, score: 0 };
    current.books += 1;
    current.score += book.rating || 0;
    counts.set(key, current);
  }

  return [...counts.values()]
    .sort(
      (left, right) =>
        right.books - left.books ||
        right.score - left.score ||
        left.name.localeCompare(right.name)
    )
    .map(({ name, books: count }) => ({ name, books: count }));
}
