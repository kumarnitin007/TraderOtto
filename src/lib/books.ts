import type { Book, BookInput, BookStatus } from "@/types/book";

const COVER_COLORS = ["#3e8179", "#3f68a0", "#75507a", "#ad7d22", "#bd5038"];

export function bookIdentityKey(title: string, author: string): string {
  return `${title.trim().toLowerCase()}\u001f${author.trim().toLowerCase()}`;
}

export function bookInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "BK";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function bookCoverColor(title: string): string {
  const hash = [...title].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return COVER_COLORS[hash % COVER_COLORS.length];
}

export const BUILTIN_SHELVES: { id: string; name: string; slug: BookStatus; builtin: true }[] = [
  { id: "reading", name: "Reading", slug: "reading", builtin: true },
  { id: "read", name: "Read", slug: "read", builtin: true },
  { id: "want_to_read", name: "Want to read", slug: "want_to_read", builtin: true },
];

export function shelfSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (!slug || BUILTIN_SHELVES.some((shelf) => shelf.slug === slug)) {
    return `shelf-${slug || "custom"}`.slice(0, 48);
  }
  return slug;
}

export const FAVORITES_FILTER = "favorites";

export function filterBooks(books: Book[], status: string): Book[] {
  return books
    .filter((book) => (status === FAVORITES_FILTER ? book.favorite : book.status === status))
    .sort((a, b) => {
      if (status === "read") {
        return (b.finishedAt ?? b.updatedAt).localeCompare(a.finishedAt ?? a.updatedAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function validateBook(input: BookInput): string | null {
  if (!input.title.trim()) return "Enter a book title.";
  if (!input.author.trim()) return "Enter the author.";
  if (input.progressPercent < 0 || input.progressPercent > 100) {
    return "Progress must be between 0 and 100.";
  }
  if (input.rating < 0 || input.rating > 5 || input.rating * 2 % 1 !== 0) {
    return "Rating must be between 0 and 5 in half-star steps.";
  }
  return null;
}

export function bookStats(books: Book[]) {
  const read = books.filter((book) => book.status === "read");
  const rated = books.filter((book) => book.rating > 0);
  const tagCounts = new Map<string, number>();
  for (const book of books) {
    for (const tag of book.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return {
    total: books.length,
    reading: books.filter((book) => book.status === "reading").length,
    completed: read.length,
    pagesRead: read.reduce((sum, book) => sum + (book.pageCount ?? 0), 0),
    averageRating: rated.length
      ? rated.reduce((sum, book) => sum + book.rating, 0) / rated.length
      : null,
    topTags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5),
  };
}
