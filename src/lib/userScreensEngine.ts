import type {
  UserScreen,
  UserScreenColumn,
  UserScreenRow,
  UserScreenRowData,
  UserScreenSummary,
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
  list: Pick<UserScreen, "columns">,
  row: UserScreenRowData,
  today = new Date(),
): RowEvaluation {
  const vals: Record<string, AutoResult> = {};
  let err: string | null = null;
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
  list: Pick<UserScreen, "columns" | "summaries">,
  rows: Pick<UserScreenRow, "data">[],
  today = new Date(),
  summary: UserScreenSummary | undefined = list.summaries[0],
): UserScreenTotals {
  const totals = new Map<string, { label: string; value: number }>();
  let skipped = 0;
  let counted = 0;
  if (!summary) return { totals, skipped, counted: rows.length };
  const by = column(list, summary.by);
  const sum = column(list, summary.sum);
  if (!by || !sum) return { totals, skipped: rows.length, counted: 0 };

  for (const row of rows) {
    const evaluation = evalRow(list, row.data, today);
    const label = String(row.data[by.id] ?? "").trim();
    if (evaluation.err || !label) {
      skipped += 1;
      continue;
    }
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

export type ScreenSummaryView = {
  by: string;
  sum: string;
  view: "bar" | "donut" | "totals";
  byLabel: string;
  sumLabel: string;
  totals: { label: string; value: number }[];
  skipped: number;
  counted: number;
  total: number;
};

export function userScreenAnalytics(
  list: Pick<UserScreen, "columns" | "summaries">,
  rows: UserScreenRow[],
  today = new Date(),
) {
  const summaries: ScreenSummaryView[] = list.summaries.map((summary) => {
    const result = groupTotals(list, rows, today, summary);
    const values = [...result.totals.values()];
    return {
      by: summary.by,
      sum: summary.sum,
      view: summary.view ?? "bar",
      byLabel: column(list, summary.by)?.label ?? "Group",
      sumLabel: column(list, summary.sum)?.label ?? "Total",
      totals: values,
      skipped: result.skipped,
      counted: result.counted,
      total: values.reduce((sum, item) => sum + item.value, 0),
    };
  });
  const primary = summaries[0];
  const formulaSkipped = rows.filter((row) => evalRow(list, row.data, today).err).length;
  const skipped = primary?.skipped ?? formulaSkipped;
  const counted = primary?.counted ?? rows.length - formulaSkipped;
  const totals = primary?.totals ?? [];
  const largest = totals.slice().sort((a, b) => b.value - a.value)[0] ?? null;
  return {
    rows: rows.length,
    counted,
    skipped,
    completionPct: rows.length ? Math.round((counted / rows.length) * 100) : 100,
    total: primary?.total ?? 0,
    groups: totals.length,
    largest,
    totals,
    summaries,
  };
}

export function screenRowPreview(
  list: Pick<UserScreen, "columns">,
  data: UserScreenRowData,
  today = new Date(),
) {
  const evaluation = evalRow(list, data, today);
  const titleColumn =
    list.columns.find((column) => column.type === "text" && String(data[column.id] ?? "").trim()) ??
    list.columns.find(
      (column) => column.type !== "auto" && String(data[column.id] ?? "").trim(),
    );
  const title = titleColumn ? String(data[titleColumn.id]).trim() : "Untitled";
  const dates = list.columns
    .filter((column) => column.type === "date")
    .map((column) => String(data[column.id] ?? "").trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .map(formatScreenDate);
  const notes = list.columns
    .filter((column) => column.type === "text" && column.id !== titleColumn?.id)
    .map((column) => String(data[column.id] ?? "").trim())
    .filter(Boolean);
  const metricColumn =
    list.columns.find((column) => column.type === "auto") ??
    list.columns.find((column) => column.type === "number");
  let metric: string | null = null;
  if (metricColumn?.type === "auto") {
    const result = evaluation.vals[metricColumn.id];
    metric = result && "v" in result ? formatScreenNumber(result.v) : null;
  } else if (metricColumn) {
    const raw = String(data[metricColumn.id] ?? "").trim();
    metric = raw || null;
  }
  return {
    title,
    detail: [dates.join(" – "), ...notes].filter(Boolean).join(" · "),
    metric,
    metricLabel: metricColumn?.label ?? "",
    invalid: Boolean(evaluation.err),
    error: evaluation.err,
  };
}

function formatScreenDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatScreenNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
