import type {
  UserScreen,
  UserScreenColumn,
  UserScreenRow,
  UserScreenRowData,
} from "@/types/userScreens";

export type AutoResult = { v: number } | { err: string };
export type RowEvaluation = {
  vals: Record<string, AutoResult>;
  err: string | null;
};

function column(list: Pick<UserScreen, "columns">, id?: string) {
  return id ? list.columns.find((item) => item.id === id) : undefined;
}

function utcDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
    ? stamp
    : null;
}

function todayUtc(today: Date) {
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

export function evalAuto(
  list: Pick<UserScreen, "columns">,
  row: UserScreenRowData,
  col: UserScreenColumn,
  today = new Date(),
): AutoResult {
  const a = column(list, col.a);
  const b = column(list, col.b);
  if (!a || !b || col.type !== "auto") return { err: "Fix the formula columns" };

  if (a.type === "date" && b.type === "date") {
    const rawA = String(row[a.id] ?? "").trim();
    const rawB = String(row[b.id] ?? "").trim();
    const aDate = rawA ? utcDay(rawA) : col.today ? todayUtc(today) : null;
    const bDate = rawB ? utcDay(rawB) : null;
    if (aDate == null) return { err: `Add ${a.label}` };
    if (bDate == null) return { err: `Add ${b.label}` };
    const days = Math.round((aDate - bDate) / 86_400_000);
    if (days < 0) return { err: `${a.label} is before ${b.label}` };
    return { v: days + (col.incl ? 1 : 0) };
  }

  if (a.type === "number" && b.type === "number") {
    const aValue = Number.parseFloat(String(row[a.id] ?? ""));
    const bValue = Number.parseFloat(String(row[b.id] ?? ""));
    if (!Number.isFinite(aValue)) return { err: `Add ${a.label}` };
    if (!Number.isFinite(bValue)) return { err: `Add ${b.label}` };
    return { v: col.op === "+" ? aValue + bValue : aValue - bValue };
  }

  return { err: "Fix the formula columns" };
}

export function evalRow(
  list: Pick<UserScreen, "columns" | "summary">,
  row: UserScreenRowData,
  today = new Date(),
): RowEvaluation {
  const vals: Record<string, AutoResult> = {};
  let err: string | null = null;
  if (list.summary) {
    const by = column(list, list.summary.by);
    if (by && !String(row[by.id] ?? "").trim()) err = `Add ${by.label}`;
  }
  for (const col of list.columns) {
    if (col.type !== "auto") continue;
    const result = evalAuto(list, row, col, today);
    vals[col.id] = result;
    if ("err" in result && !err) err = result.err;
  }
  return { vals, err };
}

export type UserScreenTotals = {
  totals: Map<string, { label: string; value: number }>;
  skipped: number;
  counted: number;
};

export function groupTotals(
  list: Pick<UserScreen, "columns" | "summary">,
  rows: Pick<UserScreenRow, "data">[],
  today = new Date(),
): UserScreenTotals {
  const totals = new Map<string, { label: string; value: number }>();
  let skipped = 0;
  let counted = 0;
  if (!list.summary) return { totals, skipped, counted: rows.length };
  const sum = column(list, list.summary.sum);
  if (!sum) return { totals, skipped: rows.length, counted: 0 };

  for (const row of rows) {
    const evaluation = evalRow(list, row.data, today);
    if (evaluation.err) {
      skipped += 1;
      continue;
    }
    const label = String(row.data[list.summary.by] ?? "").trim();
    const key = label.toLocaleLowerCase();
    const result = sum.type === "auto" ? evaluation.vals[sum.id] : null;
    const value =
      result && "v" in result
        ? result.v
        : Number.parseFloat(String(row.data[sum.id] ?? "")) || 0;
    const existing = totals.get(key);
    totals.set(key, {
      label: existing?.label ?? label,
      value: (existing?.value ?? 0) + value,
    });
    counted += 1;
  }
  return { totals, skipped, counted };
}

export function userScreenAnalytics(
  list: Pick<UserScreen, "columns" | "summary">,
  rows: UserScreenRow[],
  today = new Date(),
) {
  const summary = groupTotals(list, rows, today);
  const values = [...summary.totals.values()];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const largest = values.slice().sort((a, b) => b.value - a.value)[0] ?? null;
  return {
    rows: rows.length,
    counted: summary.counted,
    skipped: summary.skipped,
    completionPct: rows.length ? Math.round((summary.counted / rows.length) * 100) : 100,
    total,
    groups: values.length,
    largest,
    totals: values,
  };
}
