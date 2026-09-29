import { describe, expect, it } from "vitest";
import { finishedBookBody, journalSortOrder, journalStreak, noteTitle, onThisDay, orderedNotes } from "@/lib/journal";
import type { JournalEntry } from "@/types/journal";

function entry(patch: Partial<JournalEntry>): JournalEntry {
  return {
    id: "1",
    kind: "note",
    body: "Note",
    entryDate: "2026-09-29",
    prompt: "",
    tags: [],
    pinned: false,
    favorite: false,
    sortOrder: 0,
    sourceType: null,
    sourceId: null,
    createdAt: "2026-09-29T00:00:00Z",
    updatedAt: "2026-09-29T00:00:00Z",
    ...patch,
  };
}

describe("journal", () => {
  it("keeps note order inside a 32-bit integer", () => {
    expect(journalSortOrder(1_790_703_622_285)).toBe(2_147_483_647);
    expect(journalSortOrder(undefined, 1_790_703_622_285)).toBe(1_790_703_622);
    expect(journalSortOrder(4)).toBe(4);
  });

  it("counts a streak through today and keeps yesterday alive", () => {
    expect(journalStreak(["2026-09-27", "2026-09-28", "2026-09-29"], "2026-09-29")).toBe(3);
    expect(journalStreak(["2026-09-27", "2026-09-28"], "2026-09-29")).toBe(2);
    expect(journalStreak(["2026-09-26"], "2026-09-29")).toBe(0);
  });

  it("orders notes by pin, then favorite, then manual order", () => {
    const ordered = orderedNotes([
      entry({ id: "plain", sortOrder: 1 }),
      entry({ id: "pinned-late", pinned: true, sortOrder: 5 }),
      entry({ id: "star", favorite: true, sortOrder: 3 }),
      entry({ id: "pinned-early", pinned: true, sortOrder: 2 }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual([
      "pinned-early",
      "pinned-late",
      "star",
      "plain",
    ]);
  });

  it("finds this year and earlier years on this calendar day", () => {
    const found = onThisDay(
      [
        entry({ id: "today", kind: "entry", entryDate: "2026-09-29" }),
        entry({ id: "last-year", kind: "entry", entryDate: "2025-09-29" }),
        entry({ id: "note", kind: "note", entryDate: "2024-09-29" }),
        entry({ id: "other", kind: "entry", entryDate: "2026-09-28" }),
      ],
      "2026-09-29"
    );
    expect(found.map((item) => item.id)).toEqual(["today", "last-year", "note"]);
  });

  it("uses the first three words as a note title and keeps the remaining lines", () => {
    expect(noteTitle("Called mom today\nShe sounded good")).toEqual({
      title: "Called mom today",
      rest: "She sounded good",
    });
  });

  it("writes one book entry and nudges when there is no review", () => {
    expect(
      finishedBookBody({ title: "Dune", author: "Frank Herbert", rating: 4, notes: "" })
    ).toBe('Finished "Dune" by Frank Herbert\nRated 4 out of 5.\nAdd a few words about it?');
    expect(
      finishedBookBody({
        title: "Dune",
        author: "Frank Herbert",
        rating: 0,
        notes: "The politics stayed with me.",
      })
    ).toContain("The politics stayed with me.");
  });
});
