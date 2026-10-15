import { USER_SCREEN_ICONS, type UserScreenIcon, type UserScreenSummary } from "@/types/userScreens";

function isSummary(value: unknown): value is UserScreenSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.by === "string" && typeof record.sum === "string";
}

function summaryFromValue(value: UserScreenSummary): UserScreenSummary {
  return {
    by: value.by,
    sum: value.sum,
    ...(value.view === "donut" || value.view === "totals" ? { view: value.view } : {}),
  };
}

export function isUserScreenIcon(value: unknown): value is UserScreenIcon {
  return typeof value === "string" && (USER_SCREEN_ICONS as readonly string[]).includes(value);
}

export function suggestedScreenIcon(name: string): UserScreenIcon {
  const label = name.trim().toLowerCase();
  if (/(travel|trip|flight|visa)/.test(label)) return "plane";
  if (/(expense|spend|money|bill)/.test(label)) return "wallet";
  return "grid";
}

/** Reads the jsonb summary column, including screens saved before multiple summaries. */
export function readStoredSummaries(value: unknown): UserScreenSummary[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return record.items.filter(isSummary).map(summaryFromValue);
  }
  return isSummary(record) ? [summaryFromValue(record)] : [];
}

export function readStoredIcon(value: unknown): UserScreenIcon | "" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const icon = (value as Record<string, unknown>).icon;
  return isUserScreenIcon(icon) ? icon : "";
}

export function writeStoredSummaries(summaries: UserScreenSummary[], icon: UserScreenIcon | "" = "") {
  const items = summaries.map(summaryFromValue);
  const storedIcon = isUserScreenIcon(icon) ? icon : "";
  if (!items.length && !storedIcon) return null;
  return {
    ...(items.length ? { items } : {}),
    ...(storedIcon ? { icon: storedIcon } : {}),
  };
}
