import { parseCsv } from "@/lib/booksTransfer";
import type { LifeCategory, LifeInput, LifeItem } from "@/types/life";
import { LIFE_CATEGORIES } from "@/types/life";

export const LIFE_CATEGORY_LABEL: Record<LifeCategory, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  holiday: "Holiday",
  special: "Special",
  other: "Other",
};

const CATEGORY_FROM_LABEL: Record<string, LifeCategory> = {
  birthday: "birthday",
  anniversary: "anniversary",
  holiday: "holiday",
  "special event": "special",
  special: "special",
  personal: "other",
  other: "other",
};

export function lifeCategory(value: string): LifeCategory | null {
  return CATEGORY_FROM_LABEL[value.trim().toLowerCase()] ?? null;
}

export function isLifeCategory(value: string): value is LifeCategory {
  return (LIFE_CATEGORIES as readonly string[]).includes(value);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(from: Date, to: Date) {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

export function nextLifeDate(item: Pick<LifeItem, "repeats" | "month" | "day" | "occursOn">, today = new Date()) {
  if (item.repeats === "once" && item.occursOn) {
    const [year, month, day] = item.occursOn.split("-").map(Number);
    if (year && month && day) return new Date(year, month - 1, day);
  }
  const current = startOfDay(today);
  let next = new Date(current.getFullYear(), item.month - 1, item.day);
  if (next < current) next = new Date(current.getFullYear() + 1, item.month - 1, item.day);
  return next;
}

export function lifeDaysUntil(item: Pick<LifeItem, "repeats" | "month" | "day" | "occursOn">, today = new Date()) {
  return daysBetween(today, nextLifeDate(item, today));
}

export function lifeOccasionLabel(
  item: Pick<LifeItem, "category" | "year" | "repeats" | "month" | "day" | "occursOn">,
  today = new Date(),
) {
  const when = nextLifeDate(item, today);
  if (!item.year || item.year >= when.getFullYear()) return null;
  const count = when.getFullYear() - item.year;
  if (count <= 0) return null;
  if (item.category === "birthday") return `Turns ${count}`;
  if (item.category === "anniversary") return `${count} years`;
  return null;
}

export function lifeCountdownLabel(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function lifeDateInput(item: Pick<LifeItem, "repeats" | "month" | "day" | "occursOn">) {
  if (item.repeats === "once" && item.occursOn) return item.occursOn;
  const year = new Date().getFullYear();
  return `${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
}

export function applyLifeDate(iso: string, input: LifeInput): LifeInput {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return input;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (input.repeats === "once") return { ...input, month, day, occursOn: iso };
  return { ...input, month, day, occursOn: null };
}

function tagsIncludeMilestone(raw: string) {
  try {
    const tags = JSON.parse(raw) as unknown;
    return Array.isArray(tags) && tags.some((tag) => String(tag).toLowerCase() === "milestone");
  } catch {
    return /milestone/i.test(raw);
  }
}

function lifeInputFromLeoRow(row: Record<string, string>): LifeInput | null {
  const category = lifeCategory(row.category ?? "");
  if (!category || category === "other") return null;
  const name = (row.name ?? "").trim();
  if (!name) return null;
  const date = (row.date ?? "").trim();
  const yearly = /^(\d{2})-(\d{2})$/.exec(date);
  const once = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!yearly && !once) return null;
  const frequency = (row.frequency ?? "").trim().toLowerCase();
  const repeatsYearly =
    frequency === "yearly" ||
    (Boolean(once) && (category === "birthday" || category === "anniversary") && Number(once?.[1]) < new Date().getFullYear());
  const month = Number(yearly?.[1] ?? once?.[2]);
  const day = Number(yearly?.[2] ?? once?.[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const yearValue = Number(row.year);
  const eventYear = once ? Number(once[1]) : null;
  const year =
    Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= 2100 && yearValue !== eventYear
      ? yearValue
      : repeatsYearly && eventYear
        ? eventYear
        : null;
  const remind = Number(row.notifydaysbefore);
  return {
    name: name.slice(0, 160),
    category,
    notes: (row.description ?? "").trim().slice(0, 2000),
    month,
    day,
    year,
    occursOn: repeatsYearly ? null : once ? date : null,
    repeats: repeatsYearly ? "yearly" : "once",
    remindDays: Number.isInteger(remind) ? Math.min(30, Math.max(0, remind)) : 3,
    milestone: tagsIncludeMilestone(row.tags ?? ""),
  };
}

export function parseLeoEvents(text: string) {
  const section = text.split(/###\s*Events\s*###/i)[1]?.split(/###\s+/)[0] ?? "";
  const table = parseCsv(section);
  const headers = (table[0] ?? []).map((header) => header.trim().toLowerCase());
  const seen = new Set<string>();
  const items: LifeInput[] = [];
  for (const cells of table.slice(1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    const item = lifeInputFromLeoRow(row);
    if (!item) continue;
    const key = `${item.category}|${item.name.toLowerCase()}|${item.month}|${item.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

export function lifeIdentityKey(item: Pick<LifeItem, "category" | "name" | "month" | "day">) {
  return `${item.category}|${item.name.trim().toLowerCase()}|${item.month}|${item.day}`;
}
