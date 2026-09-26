import { describe, expect, it } from "vitest";
import { mapOpenLibraryDocument, openLibraryCoverUrl } from "@/lib/openLibrary";

describe("Open Library helpers", () => {
  it("creates cover URLs that return 404 when no cover exists", () => {
    expect(openLibraryCoverUrl(9255566, "M")).toBe(
      "https://covers.openlibrary.org/b/id/9255566-M.jpg?default=false"
    );
    expect(openLibraryCoverUrl(null)).toBeNull();
  });

  it("maps a search document and prefers a 13-digit ISBN", () => {
    expect(
      mapOpenLibraryDocument({
        key: "/works/OL27258W",
        title: "Dune Messiah",
        author_name: ["Frank Herbert"],
        cover_i: 9255566,
        isbn: ["0441172695", "9780441172696"],
        first_publish_year: 1969,
        number_of_pages_median: 256,
        subject: ["Science fiction", "Political", "Accessible book", "Science fiction"],
      })
    ).toEqual({
      title: "Dune Messiah",
      author: "Frank Herbert",
      isbn: "9780441172696",
      openLibraryId: "OL27258W",
      coverId: 9255566,
      pageCount: 256,
      firstPublishYear: 1969,
      subjects: ["science fiction", "political"],
    });
  });

  it("rejects documents without a title", () => {
    expect(mapOpenLibraryDocument({ author_name: ["Unknown"] })).toBeNull();
  });
});
