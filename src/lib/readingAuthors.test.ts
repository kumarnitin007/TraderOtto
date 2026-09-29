import { describe, expect, it } from "vitest";
import { readingAuthors } from "@/lib/readingAuthors";

describe("reading authors", () => {
  it("suggests authors from read and reading books, most-read first", () => {
    expect(
      readingAuthors([
        { author: "Frank Herbert", status: "read", rating: 5 },
        { author: " frank herbert ", status: "reading", rating: 4 },
        { author: "Arkady Martine", status: "want_to_read", rating: 0 },
        { author: "N.K. Jemisin", status: "read", rating: 5 },
      ])
    ).toEqual([
      { name: "Frank Herbert", books: 2 },
      { name: "N.K. Jemisin", books: 1 },
    ]);
  });

  it("falls back to any saved author when nothing has been read", () => {
    expect(
      readingAuthors([{ author: "Tamsyn Muir", status: "want_to_read", rating: 0 }])
    ).toEqual([{ name: "Tamsyn Muir", books: 1 }]);
  });
});
