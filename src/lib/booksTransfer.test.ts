import { describe, expect, it } from "vitest";
import {
  bookshelfExportCsv,
  booksToExport,
  mergeImportEntries,
  parseBookshelfFile,
  type BookExportOptions,
} from "@/lib/booksTransfer";
import { EMPTY_BOOK_JOURNAL, type Book } from "@/types/book";

const options: BookExportOptions = {
  shelves: [],
  favoritesOnly: false,
  includeReviews: true,
  includeRatings: true,
  includeCovers: true,
};

function book(patch: Partial<Book> & Pick<Book, "id" | "title">): Book {
  return {
    userId: "user",
    author: "Ada Author",
    status: "read",
    progressPercent: 100,
    rating: 4,
    wouldRecommend: null,
    format: "print",
    pageCount: null,
    durationMinutes: null,
    startedAt: null,
    finishedAt: "2026-02-02",
    notes: "A fine read",
    tags: [],
    seriesTitle: "",
    seriesIndex: null,
    isbn: "",
    openLibraryId: "",
    coverId: 12,
    coverColor: "#333",
    favorite: false,
    journal: { ...EMPTY_BOOK_JOURNAL },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

describe("export options", () => {
  it("keeps only the chosen shelves and favorites", () => {
    const books = [
      book({ id: "a", title: "Kept", status: "read", favorite: true }),
      book({ id: "b", title: "Other shelf", status: "want_to_read", favorite: true }),
      book({ id: "c", title: "Not favorite", status: "read" }),
    ];
    const picked = booksToExport(books, {
      ...options,
      shelves: ["read"],
      favoritesOnly: true,
    });
    expect(picked.map((item) => item.title)).toEqual(["Kept"]);
  });

  it("leaves reviews and ratings out when they are turned off", () => {
    const csv = bookshelfExportCsv([book({ id: "a", title: "Quiet" })], [], {
      ...options,
      includeReviews: false,
      includeRatings: false,
    });
    expect(csv).not.toContain("A fine read");
    expect(csv).not.toContain("2026-02-02");
  });
});

describe("import merging", () => {
  it("folds a repeated book into one entry and keeps the best fields", () => {
    const entries = parseBookshelfFile(
      JSON.stringify([
        { title: "The Unwind", author: "Neal Shusterman", rating: 0, review: "" },
        {
          title: "Unwind",
          author: "Neal Shusterman",
          rating: 5,
          review: "Tense all the way",
          coverUrl: "https://covers.openlibrary.org/b/id/77-M.jpg",
        },
      ])
    );
    const merged = mergeImportEntries(entries);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      rating: 5,
      review: "Tense all the way",
      coverId: 77,
    });
  });
});
