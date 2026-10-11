import type { JournalEntry, JournalInput } from "@/types/journal";

const CSV_HEADERS = [
  "kind",
  "entry_date",
  "prompt",
  "body",
  "tags",
  "pinned",
  "favorite",
  "source_type",
  "source_id",
] as const;

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function writingExportJson(entries: JournalEntry[]) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      entries: entries.map((entry) => ({
        kind: entry.kind,
        entryDate: entry.entryDate,
        prompt: entry.prompt,
        body: entry.body,
        tags: entry.tags,
        pinned: entry.pinned,
        favorite: entry.favorite,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
      })),
    },
    null,
    2
  );
}

export function writingExportCsv(entries: JournalEntry[]) {
  const rows = entries.map((entry) =>
    [
      entry.kind,
      entry.entryDate,
      entry.prompt,
      entry.body,
      entry.tags.join("|"),
      entry.pinned ? "true" : "false",
      entry.favorite ? "true" : "false",
      entry.sourceType ?? "",
      entry.sourceId ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

function asInput(value: unknown): JournalInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const body = typeof row.body === "string" ? row.body.trim() : "";
  const entryDate = typeof row.entryDate === "string" ? row.entryDate : "";
  if (!body || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return null;
  const tags = Array.isArray(row.tags)
    ? row.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    kind: row.kind === "note" ? "note" : "entry",
    body,
    entryDate,
    prompt: typeof row.prompt === "string" ? row.prompt : "",
    tags,
    pinned: row.pinned === true,
    favorite: row.favorite === true,
    sourceType: typeof row.sourceType === "string" ? row.sourceType : null,
    sourceId: typeof row.sourceId === "string" ? row.sourceId : null,
  };
}

/** Reads an Otto Journal JSON backup. CSV files are not imported. */
export function parseWritingBackup(text: string): JournalInput[] {
  const parsed = JSON.parse(text) as { entries?: unknown };
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("This file is not an Otto Journal backup.");
  }
  return parsed.entries.map(asInput).filter((entry): entry is JournalInput => entry != null);
}

function writingKey(entry: { kind: string; entryDate: string; body: string }) {
  return `${entry.kind}|${entry.entryDate}|${entry.body.trim()}`;
}

/** Entries in the file that are not already saved. */
export function newWritingEntries(existing: JournalEntry[], incoming: JournalInput[]) {
  const seen = new Set(existing.map(writingKey));
  return incoming.filter((entry) => {
    const key = writingKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
