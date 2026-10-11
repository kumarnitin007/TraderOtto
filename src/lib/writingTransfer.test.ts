import { describe, expect, it } from "vitest";
import { newWritingEntries, parseWritingBackup, writingExportJson } from "@/lib/writingTransfer";
import type { JournalEntry } from "@/types/journal";

const entry: JournalEntry = {
  id: "e1",
  kind: "entry",
  body: "A quiet morning.",
  entryDate: "2026-10-08",
  prompt: "",
  tags: ["home"],
  pinned: false,
  favorite: true,
  sortOrder: 1,
  sourceType: null,
  sourceId: null,
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
};

describe("journal backup", () => {
  it("round-trips entries and skips ones already saved", () => {
    const incoming = parseWritingBackup(writingExportJson([entry]));
    expect(incoming).toHaveLength(1);
    expect(incoming[0].body).toBe("A quiet morning.");
    expect(newWritingEntries([entry], incoming)).toHaveLength(0);
    expect(
      newWritingEntries([], [{ ...incoming[0], body: "A new note.", kind: "note" }])
    ).toHaveLength(1);
  });

  it("rejects a file that is not a journal backup", () => {
    expect(() => parseWritingBackup('{"trades":[]}')).toThrow(/Otto Journal backup/);
  });
});
