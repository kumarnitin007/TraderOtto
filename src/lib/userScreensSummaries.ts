import type { UserScreenSummary } from "@/types/userScreens";

function isSummary(value: unknown): value is UserScreenSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.by === "string" && typeof record.sum === "string";
}

/** Reads the jsonb summary column, including screens saved before multiple summaries. */
export function readStoredSummaries(value: unknown): UserScreenSummary[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return record.items.filter(isSummary).map((item) => ({ by: item.by, sum: item.sum }));
  }
  return isSummary(record) ? [{ by: record.by, sum: record.sum }] : [];
}

export function writeStoredSummaries(summaries: UserScreenSummary[]) {
  return summaries.length
    ? { items: summaries.map((item) => ({ by: item.by, sum: item.sum })) }
    : null;
}
