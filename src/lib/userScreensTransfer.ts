import { parseCsv } from "@/lib/booksTransfer";
import { evalRow } from "@/lib/userScreensEngine";
import { isUserScreenIcon, writeStoredSummaries } from "@/lib/userScreensSummaries";
import { validateUserScreen } from "@/lib/userScreensTemplates";
import {
  USER_SCREEN_COLUMN_LIMIT,
  USER_SCREEN_COLUMN_TYPES,
  USER_SCREEN_ROW_LIMIT,
  type UserScreen,
  type UserScreenColumn,
  type UserScreenInput,
  type UserScreenRow,
  type UserScreenRowData,
  type UserScreenSummary,
} from "@/types/userScreens";

export type UserScreenBackup = UserScreenInput & { rows: UserScreenRowData[] };

function safeName(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "user-screen";
}

export function userScreenJson(list: UserScreen, rows: UserScreenRow[]) {
  return {
    fileName: `${safeName(list.name)}.json`,
    text: JSON.stringify(
      {
        ottoList: 1,
        name: list.name,
        columns: list.columns,
        icon: list.icon || undefined,
        summary: writeStoredSummaries(list.summaries, list.icon),
        rows: rows.map((row) => row.data),
      },
      null,
      2,
    ),
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function userScreenCsv(list: UserScreen, rows: UserScreenRow[]) {
  const lines = [list.columns.map((column) => csvCell(column.label)).join(",")];
  for (const row of rows) {
    const evaluation = evalRow(list, row.data);
    lines.push(
      list.columns
        .map((column) => {
          if (column.type === "auto") {
            const result = evaluation.vals[column.id];
            return csvCell(!evaluation.err && result && "v" in result ? result.v : "");
          }
          if (column.type === "check") return csvCell(row.data[column.id] ? "yes" : "no");
          return csvCell(row.data[column.id] ?? "");
        })
        .join(","),
    );
  }
  return { fileName: `${safeName(list.name)}.csv`, text: `\uFEFF${lines.join("\r\n")}` };
}

function parseBackupSummaries(value: unknown): UserScreenSummary[] {
  if (value == null) return [];
  if (!isObject(value)) throw new Error("The summary definition is invalid.");
  if (Array.isArray(value.items)) {
    return value.items.map((item) => {
      if (!isObject(item) || typeof item.by !== "string" || typeof item.sum !== "string") {
        throw new Error("The summary definition is invalid.");
      }
      return {
        by: item.by,
        sum: item.sum,
        ...(item.view === "donut" || item.view === "totals" ? { view: item.view } : {}),
      };
    });
  }
  if (typeof value.by === "string" && typeof value.sum === "string") {
    return [{
      by: value.by,
      sum: value.sum,
      ...(value.view === "donut" || value.view === "totals" ? { view: value.view } : {}),
    }];
  }
  throw new Error("The summary definition is invalid.");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseUserScreenJson(text: string): UserScreenBackup {
  if (new Blob([text]).size > 2_000_000) throw new Error("Choose a JSON file smaller than 2 MB.");
  let raw: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text);
    if (!isObject(parsed)) throw new Error();
    raw = parsed;
  } catch {
    throw new Error("This is not a valid User Screens JSON file.");
  }
  if (raw.ottoList !== 1 && raw.leoList !== 1) throw new Error("This file is not an Otto list backup.");
  if (!Array.isArray(raw.columns) || raw.columns.length > USER_SCREEN_COLUMN_LIMIT) {
    throw new Error("The backup must contain no more than 20 columns.");
  }
  const columns: UserScreenColumn[] = raw.columns.map((value) => {
    if (!isObject(value)) throw new Error("A column definition is invalid.");
    const type = String(value.type);
    if (!(USER_SCREEN_COLUMN_TYPES as readonly string[]).includes(type)) {
      throw new Error(`Unknown column type: ${type}.`);
    }
    return {
      id: String(value.id ?? ""),
      label: String(value.label ?? ""),
      type: type as UserScreenColumn["type"],
      ...(type === "auto"
        ? {
            a: typeof value.a === "string" ? value.a : undefined,
            b: typeof value.b === "string" ? value.b : undefined,
            op: value.op === "+" ? "+" : "-",
            ...(typeof value.incl === "boolean" ? { incl: value.incl } : {}),
            ...(typeof value.today === "boolean" ? { today: value.today } : {}),
          }
        : {}),
    };
  });
  const summaries = parseBackupSummaries(raw.summary);
  const summaryIcon = isObject(raw.summary) ? raw.summary.icon : undefined;
  const icon = isUserScreenIcon(raw.icon) ? raw.icon : isUserScreenIcon(summaryIcon) ? summaryIcon : "";
  const input: UserScreenInput = { name: String(raw.name ?? ""), columns, summaries, icon };
  const validation = validateUserScreen(input);
  if (validation) throw new Error(validation);
  if (!Array.isArray(raw.rows) || raw.rows.length > USER_SCREEN_ROW_LIMIT) {
    throw new Error("The backup must contain no more than 5,000 rows.");
  }
  const ids = new Set(columns.map((column) => column.id));
  const rows = raw.rows.map((value) => {
    if (!isObject(value)) throw new Error("A row in this backup is invalid.");
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, cell]) => ids.has(key) && (typeof cell === "string" || typeof cell === "boolean"))
        .map(([key, cell]) => [key, cell as string | boolean]),
    );
  });
  return { ...input, rows };
}

const DATE_FAMILIES = [
  ["start date", "start", "date out", "departure", "departure date", "from date", "leave date", "left date"],
  ["end date", "end", "date in", "return", "return date", "arrival", "arrival date", "to date", "back date"],
];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export type ScreenImportKind = "column" | "add" | "skip";

export interface ScreenImportAssignment {
  headerIndex: number;
  header: string;
  kind: ScreenImportKind;
  columnId?: string;
  reason?: string;
}

export interface ScreenImportResult {
  rows: UserScreenRowData[];
  addedColumns: UserScreenColumn[];
  blankSkipped: number;
  dateProblems: { row: number; column: string; value: string }[];
}

export function parseUserScreenCsv(list: UserScreen, text: string) {
  const { headers, body } = splitScreenTable(parseCsv(text));
  const assignments = suggestScreenImport(list, headers).map((assignment) =>
    assignment.kind === "add" ? { ...assignment, kind: "skip" as const, reason: "unmatched" } : assignment,
  );
  const applied = applyScreenImport(list, headers, body, assignments);
  return {
    rows: applied.rows.filter((row) => Object.values(row).some((value) => value !== "" && value !== false)),
    ignoredHeaders: assignments.filter((assignment) => assignment.kind === "skip").length,
  };
}

export function splitScreenTable(table: unknown[][]) {
  const headerAt = table.findIndex(
    (row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2,
  );
  const start = headerAt < 0 ? 0 : headerAt;
  const headerRow = table[start] ?? [];
  return {
    headers: headerRow.map((cell) => String(cell ?? "").trim()),
    body: table.slice(start + 1),
  };
}

export function suggestScreenImport(
  list: Pick<UserScreen, "columns">,
  headers: string[],
  createId: () => string = () => crypto.randomUUID(),
): ScreenImportAssignment[] {
  const assignments: ScreenImportAssignment[] = headers.map((header, headerIndex) => ({
    headerIndex,
    header,
    kind: "skip",
    reason: header.trim() ? undefined : "blank",
  }));
  const used = new Set<string>();
  const claim = (index: number, column: UserScreenColumn) => {
    used.add(column.id);
    assignments[index] = {
      headerIndex: index,
      header: headers[index] ?? "",
      kind: "column",
      columnId: column.id,
    };
  };

  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key) return;
    const exact = list.columns.find(
      (column) => !used.has(column.id) && normalizeHeader(column.label) === key,
    );
    if (!exact) return;
    if (exact.type === "auto") {
      assignments[index] = { headerIndex: index, header, kind: "skip", reason: "calculated" };
      used.add(exact.id);
      return;
    }
    claim(index, exact);
  });

  headers.forEach((header, index) => {
    if (assignments[index]?.kind !== "skip" || assignments[index]?.reason) return;
    const family = dateFamily(header);
    if (family < 0) return;
    const column = list.columns.find(
      (item) => item.type === "date" && !used.has(item.id) && dateFamily(item.label) === family,
    );
    if (column) claim(index, column);
  });

  headers.forEach((header, index) => {
    if (assignments[index]?.kind !== "skip" || assignments[index]?.reason || !header.trim()) return;
    assignments[index] = {
      headerIndex: index,
      header,
      kind: "add",
      columnId: createId(),
    };
  });
  return assignments;
}

export function applyScreenImport(
  list: Pick<UserScreen, "columns">,
  headers: string[],
  body: unknown[][],
  assignments: ScreenImportAssignment[],
): ScreenImportResult {
  const room = USER_SCREEN_COLUMN_LIMIT - list.columns.length;
  const addedColumns: UserScreenColumn[] = [];
  const active = assignments.map((assignment) => {
    if (assignment.kind !== "add") return assignment;
    if (addedColumns.length >= room || !assignment.header.trim()) {
      return { ...assignment, kind: "skip" as const, reason: "column limit" };
    }
    const column: UserScreenColumn = {
      id: assignment.columnId || `added-${addedColumns.length + 1}`,
      label: assignment.header.trim().slice(0, 40),
      type: "text",
    };
    addedColumns.push(column);
    return { ...assignment, columnId: column.id };
  });
  const columns = new Map(
    [...list.columns, ...addedColumns].map((column) => [column.id, column]),
  );
  const rows: UserScreenRowData[] = [];
  const dateProblems: ScreenImportResult["dateProblems"] = [];
  let blankSkipped = 0;

  body.forEach((cells, index) => {
    const row: UserScreenRowData = {};
    let occupied = false;
    active.forEach((assignment) => {
      if (assignment.kind === "skip" || !assignment.columnId) return;
      const column = columns.get(assignment.columnId);
      if (!column || column.type === "auto") return;
      const raw = cells[assignment.headerIndex];
      const parsed = coerceScreenCell(column, raw);
      if (parsed.problem) {
        dateProblems.push({
          row: index + 2,
          column: headers[assignment.headerIndex] || column.label,
          value: String(raw ?? "").trim(),
        });
      }
      if (parsed.value !== "" && parsed.value !== false) occupied = true;
      row[column.id] = parsed.value;
    });
    if (!occupied) blankSkipped += 1;
    else rows.push(row);
  });

  return { rows, addedColumns, blankSkipped, dateProblems };
}

export async function tableFromSpreadsheet(buffer: ArrayBuffer, fileName: string) {
  const bytes = new Uint8Array(buffer);
  const zip = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!zip && (fileName.toLowerCase().endsWith(".csv") || !fileName.toLowerCase().endsWith(".xlsx"))) {
    return parseCsv(new TextDecoder().decode(buffer));
  }
  const XLSX = await import("xlsx");
  const book = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
}

export function parseScreenDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return parseScreenDate(Number(text));
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return isoDate(...numericParts(text.slice(0, 10).split("-").map(Number)));
  const dayMonth = text.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s,/]+(\d{2,4})$/);
  if (dayMonth) return isoDate(expandYear(Number(dayMonth[3])), monthNumber(dayMonth[2]), Number(dayMonth[1]));
  const monthDay = text.match(/^([A-Za-z]{3,9})[-\s/]+(\d{1,2}),?[-\s]+(\d{2,4})$/);
  if (monthDay) return isoDate(expandYear(Number(monthDay[3])), monthNumber(monthDay[1]), Number(monthDay[2]));
  const numeric = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (!numeric) return null;
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  const year = expandYear(Number(numeric[3]));
  if (first > 12) return isoDate(year, second, first);
  if (second > 12) return isoDate(year, first, second);
  return isoDate(year, first, second);
}

function coerceScreenCell(column: UserScreenColumn, value: unknown) {
  if (column.type === "check") {
    return { value: /^(yes|true|1|y)$/i.test(String(value ?? "").trim()), problem: false };
  }
  if (value == null || String(value).trim() === "") return { value: "", problem: false };
  if (column.type === "date") {
    const iso = parseScreenDate(value);
    return iso ? { value: iso, problem: false } : { value: "", problem: true };
  }
  if (column.type === "number") {
    const text = typeof value === "number" ? String(value) : String(value).replace(/[$,]/g, "").trim();
    return { value: text, problem: false };
  }
  return { value: String(value).trim(), problem: false };
}

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function dateFamily(value: string) {
  const key = normalizeHeader(value);
  return DATE_FAMILIES.findIndex((family) => family.includes(key));
}

function monthNumber(name: string) {
  const lower = name.toLocaleLowerCase();
  if (lower.startsWith("sept")) return 9;
  const index = MONTHS.indexOf(lower.slice(0, 3));
  return index + 1;
}

function expandYear(year: number) {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function numericParts(parts: number[]): [number, number, number] {
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isoDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
