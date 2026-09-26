import { describe, expect, it } from "vitest";
import { bookInitials, bookStats, filterBooks, validateBook } from "@/lib/books";
import { EMPTY_BOOK_JOURNAL, type Book, type BookInput } from "@/types/book";

const input: BookInput = {
  title: "Dune Messiah",
  author: "Frank Herbert",
  status: "read",
  progressPercent: 100,
  rating: 4,
  wouldRecommend: true,
  format: "audiobook",
  pageCount: 331,
  durationMinutes: null,
  startedAt: null,
  finishedAt: "2026-09-12",
  notes: "",
  tags: ["sci-fi"],
  seriesTitle: "Dune",
  seriesIndex: 2,
  isbn: "9780441172696",
  openLibraryId: "OL27258W",
  coverId: 9255566,
  coverColor: "#75507a",
  favorite: false,
  journal: EMPTY_BOOK_JOURNAL,
};

function book(id: string, patch: Partial<Book> = {}): Book {
  return {
    ...input,
    id,
    userId: "user",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

describe("Books domain helpers", () => {
  it("builds short cover initials", () => {
    expect(bookInitials("Project Hail Mary")).toBe("PH");
    expect(bookInitials("Dune")).toBe("D");
  });

  it("validates required fields and half-star ratings", () => {
    expect(validateBook(input)).toBeNull();
    expect(validateBook({ ...input, title: "" })).toMatch(/title/i);
    expect(validateBook({ ...input, rating: 4.2 })).toMatch(/half-star/i);
  });

  it("filters and sorts finished books by completion date", () => {
    const books = [
      book("older", { finishedAt: "2026-01-01" }),
      book("reading", { status: "reading", finishedAt: null }),
      book("newer", { finishedAt: "2026-09-01" }),
    ];
    expect(filterBooks(books, "read").map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("derives reading statistics", () => {
    const stats = bookStats([
      book("one", { tags: ["sci-fi"], pageCount: 300 }),
      book("two", { status: "reading", rating: 0, tags: ["sci-fi", "series"] }),
    ]);
    expect(stats.completed).toBe(1);
    expect(stats.reading).toBe(1);
    expect(stats.pagesRead).toBe(300);
    expect(stats.topTags[0]).toEqual(["sci-fi", 2]);
  });
});
