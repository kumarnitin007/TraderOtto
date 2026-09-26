import { describe, expect, it } from "vitest";
import { coverPatchFromSearch, planLibraryCleanup } from "@/lib/bookCleanup";
import { EMPTY_BOOK_JOURNAL, type Book } from "@/types/book";

function book(patch: Partial<Book> & Pick<Book, "id" | "title">): Book {
  return {
    userId: "user",
    author: "Ada Author",
    status: "read",
    progressPercent: 100,
    rating: 0,
    wouldRecommend: null,
    format: "print",
    pageCount: null,
    durationMinutes: null,
    startedAt: null,
    finishedAt: null,
    notes: "",
    tags: [],
    seriesTitle: "",
    seriesIndex: null,
    isbn: "",
    openLibraryId: "",
    coverId: null,
    coverColor: "#333",
    favorite: false,
    journal: { ...EMPTY_BOOK_JOURNAL },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

describe("library cleanup", () => {
  it("keeps the richer copy and fills notes from the other", () => {
    const actions = planLibraryCleanup([
      book({ id: "a", title: "The Golden Gate", notes: "Loved the ending", rating: 4 }),
      book({
        id: "b",
        title: "Golden Gate",
        coverId: 42,
        createdAt: "2026-02-01T00:00:00Z",
      }),
    ]);
    expect(actions[0]).toMatchObject({
      bookId: "b",
      kind: "update",
      patch: { notes: "Loved the ending", rating: 4 },
    });
    expect(actions[1]).toMatchObject({ bookId: "a", kind: "remove" });
  });

  it("recovers a cover id stored only as a link", () => {
    const actions = planLibraryCleanup([
      book({
        id: "a",
        title: "Space Case",
        journal: {
          ...EMPTY_BOOK_JOURNAL,
          coverUrl: "https://covers.openlibrary.org/b/id/88-M.jpg",
        },
      }),
    ]);
    expect(actions[0]).toMatchObject({ kind: "update", patch: { coverId: 88 } });
  });

  it("does not take an Open Library hit when the title is different", () => {
    const current = book({ id: "a", title: "Dog Man", author: "Dav Pilkey" });
    expect(
      coverPatchFromSearch(current, [
        {
          title: "Captain Underpants",
          author: "Dav Pilkey",
          isbn: "123",
          openLibraryId: "OL1W",
          coverId: 9,
          pageCount: 100,
          firstPublishYear: 1997,
          subjects: ["comics"],
        },
      ]),
    ).toBeNull();
    expect(
      coverPatchFromSearch(current, [
        {
          title: "Dog Man",
          author: "Dav Pilkey",
          isbn: "999",
          openLibraryId: "OL2W",
          coverId: 15,
          pageCount: 240,
          firstPublishYear: 2016,
          subjects: ["comics"],
        },
      ]),
    ).toMatchObject({ coverId: 15, isbn: "999", tags: ["comics"] });
  });
});
