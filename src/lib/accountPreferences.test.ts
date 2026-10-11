import { describe, expect, it } from "vitest";
import { parseTradeImportHistory, parseWorkspacePreferences } from "@/lib/accountPreferences";

describe("account preferences", () => {
  it("keeps a saved workspace and fills safe defaults", () => {
    const parsed = parseWorkspacePreferences({
      theme: "dark",
      tradeScope: "credit_spreads",
      enabledSections: ["trader", "books"],
      defaultSection: "books",
      booksOpenLibraryEnabled: false,
      books: { likedGenres: "mystery", logFinishedBooks: false, catalogs: [] },
      journal: { showStreak: false, suggestTags: true },
      banks: { home: "INR", inrPerUsd: 83 },
    });
    expect(parsed?.theme).toBe("dark");
    expect(parsed?.tradeScope).toBe("credit_spreads");
    expect(parsed?.defaultSection).toBe("books");
    expect(parsed?.books.logFinishedBooks).toBe(false);
    expect(parsed?.journal.promptOfDay).toBe(true);
    expect(parsed?.banks.inrPerUsd).toBe(83);
  });

  it("ignores a workspace blob that is missing its sections", () => {
    expect(parseWorkspacePreferences({ theme: "dark" })).toBeNull();
    expect(parseWorkspacePreferences(null)).toBeNull();
  });

  it("keeps import history that can still be undone", () => {
    const records = parseTradeImportHistory([
      {
        id: "a",
        at: "2026-10-11T00:00:00Z",
        fileName: "today.csv",
        imported: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
        unmatched: [],
        createdIds: ["t1"],
        before: [],
        removed: [],
        undone: false,
      },
      { id: "bad" },
    ]);
    expect(records?.map((record) => record.id)).toEqual(["a"]);
  });
});
