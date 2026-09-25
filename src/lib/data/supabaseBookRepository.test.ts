import { describe, expect, it } from "vitest";
import { mapBookRow } from "@/lib/data/supabaseBookRepository";

describe("Supabase book mapping", () => {
  it("maps database fields and safely filters tags", () => {
    const book = mapBookRow({
      id: "book",
      user_id: "user",
      title: "Dune Messiah",
      author: "Frank Herbert",
      status: "read",
      progress_percent: 100,
      rating: 4,
      would_recommend: true,
      format: "print",
      page_count: 331,
      duration_minutes: null,
      started_at: null,
      finished_at: "2026-09-12",
      notes: null,
      tags: ["sci-fi", 2],
      series_title: "Dune",
      series_index: 2,
      isbn: "9780441172696",
      open_library_id: "OL27258W",
      cover_id: 9255566,
      cover_color: "#75507a",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-09-12T00:00:00Z",
    });
    expect(book.userId).toBe("user");
    expect(book.tags).toEqual(["sci-fi"]);
    expect(book.notes).toBe("");
    expect(book.rating).toBe(4);
    expect(book.coverId).toBe(9255566);
  });
});
