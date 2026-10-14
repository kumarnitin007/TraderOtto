import { parseCsv } from "@/lib/booksTransfer";
import { evalRow } from "@/lib/userScreensEngine";
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
        summary: list.summary,
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
  const summary: UserScreenSummary | null =
    raw.summary == null
      ? null
      : isObject(raw.summary) &&
          typeof raw.summary.by === "string" &&
          typeof raw.summary.sum === "string"
        ? { by: raw.summary.by, sum: raw.summary.sum }
        : (() => {
            throw new Error("The summary definition is invalid.");
          })();
  const input: UserScreenInput = { name: String(raw.name ?? ""), columns, summary };
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

export function parseUserScreenCsv(list: UserScreen, text: string) {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  const headers = table[0] ?? [];
  const matched = new Map<number, UserScreenColumn>();
  const seen = new Set<string>();
  headers.forEach((header, index) => {
    const key = header.trim().toLocaleLowerCase();
    const column = list.columns.find(
      (item) => item.type !== "auto" && item.label.trim().toLocaleLowerCase() === key,
    );
    if (column && !seen.has(column.id)) {
      matched.set(index, column);
      seen.add(column.id);
    }
  });
  const rows = table.slice(1).map((cells) => {
    const row: UserScreenRowData = {};
    matched.forEach((column, index) => {
      const value = cells[index] ?? "";
      row[column.id] =
        column.type === "check" ? /^(yes|true|1)$/i.test(value.trim()) : value;
    });
    return row;
  });
  return {
    rows,
    ignoredHeaders: headers.length - matched.size,
  };
}
