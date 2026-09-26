import { describe, expect, it } from "vitest";
import { BUILTIN_SHELVES } from "@/lib/books";
import { bookInputFromImport, parseBookshelfFile, shelfNamesToCreate } from "@/lib/booksTransfer";

const CSV = `Title,Author,Bookshelf,Bookshelf Type,Rating,Start Date,Finish Date,Description,Favorite Character,Scene Summary,Memorable Moments,Review,Least Favorite Part
"Golden Gate","James Ponti","Kaashvis books con.","regular",4,,,"Full of adventure","Brooklyn","","","Good, but not mind-blowing",""
"They Wish They Were Us","Jessica Goodman","Kaashvi's Books*","regular",4,,2025-12-17,"A mystery, ""The Players"".","","","When they find out.","Packed with drama",""
"Space Case","Stuart Gibbs","Summer reading 2026","regular",4,,,"","","","Summer reading
week","Fun book",""
`;

describe("bookshelf import", () => {
  it("reads quoted commas, quotes, and line breaks from the CSV export", () => {
    const books = parseBookshelfFile(CSV);
    expect(books).toHaveLength(3);
    expect(books[0]).toMatchObject({
      title: "Golden Gate",
      author: "James Ponti",
      shelfName: "Kaashvis books con.",
      rating: 4,
      review: "Good, but not mind-blowing",
    });
    expect(books[1].journal.description).toContain('"The Players"');
    expect(books[1].finishedAt).toBe("2025-12-17");
    expect(books[2].journal.memorableMoments).toBe("Summer reading\nweek");
  });

  it("reads the JSON export, cover id, genre tags, and wishlist shelf", () => {
    const books = parseBookshelfFile(
      JSON.stringify([
        {
          title: "Gather the Daughters: A Novel",
          author: "Jennie Melamed",
          genre: "Fiction, dystopian",
          coverUrl: "https://covers.openlibrary.org/b/id/8430935-L.jpg",
          review: null,
          rating: 0,
          bookshelfName: "Books to read",
          bookshelfType: "wishlist",
        },
      ])
    );
    expect(books[0].coverId).toBe(8430935);
    expect(books[0].tags).toEqual(["fiction", "dystopian"]);
    expect(books[0].journal.bookshelfType).toBe("wishlist");
    expect(shelfNamesToCreate(books, BUILTIN_SHELVES)).toEqual(["Books to read"]);
    expect(bookInputFromImport(books[0], BUILTIN_SHELVES).status).toBe("books-to-read");
  });
});
