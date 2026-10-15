import { describe, expect, it } from "vitest";
import {
  applyScreenImport,
  parseScreenDate,
  parseUserScreenCsv,
  parseUserScreenJson,
  splitScreenTable,
  suggestScreenImport,
  tableFromSpreadsheet,
  userScreenCsv,
  userScreenJson,
} from "@/lib/userScreensTransfer";
import type { UserScreen, UserScreenRow } from "@/types/userScreens";

const list: UserScreen = {
  id: "list",
  name: "Travel log",
  position: 0,
  columns: [
    { id: "person", label: "Person", type: "text" },
    { id: "start", label: "Start date", type: "date" },
    { id: "end", label: "End date", type: "date" },
    { id: "days", label: "Total days", type: "auto", a: "end", b: "start", op: "-", incl: true },
  ],
  summaries: [{ by: "person", sum: "days" }],
  createdAt: "",
  updatedAt: "",
};
const rows: UserScreenRow[] = [
  {
    id: "row",
    listId: "list",
    data: { person: "A", start: "2026-01-03", end: "2026-01-19" },
    createdAt: "",
    updatedAt: "",
  },
];

describe("user screens transfer", () => {
  it("round trips a JSON screen", () => {
    const exported = userScreenJson(list, rows);
    expect(parseUserScreenJson(exported.text)).toEqual({
      name: "Travel log",
      columns: list.columns,
      summaries: list.summaries,
      rows: [rows[0].data],
    });
  });

  it("exports computed CSV values with a BOM", () => {
    const exported = userScreenCsv(list, rows);
    expect(exported.text.startsWith("\uFEFF")).toBe(true);
    expect(exported.text).toContain("A,2026-01-03,2026-01-19,17");
  });

  it("matches CSV columns by label and ignores formula or unknown columns", () => {
    const parsed = parseUserScreenCsv(
      list,
      "PERSON,Start date,End date,Total days,Unknown\nA,2026-01-03,2026-01-19,999,x",
    );
    expect(parsed.rows).toEqual([
      { person: "A", start: "2026-01-03", end: "2026-01-19" },
    ]);
    expect(parsed.ignoredHeaders).toBe(2);
  });

  it("maps travel date names and day-month-year values", () => {
    const table = splitScreenTable([
      ["Person", "Date Out", "Date In", "Total days", "Comments", "Description"],
      ["Nitin", "28-Jan-23", "28-Jan-23", 1, "", "Canada by Road"],
      ["", "", "", "", "", ""],
      ["Riddhi", "1-Aug-23", "9-Sep-23", 39, "N", "India"],
    ]);
    let nextId = 0;
    const assignments = suggestScreenImport(list, table.headers, () => `added-${(nextId += 1)}`);
    expect(assignments.map((item) => [item.header, item.kind, item.columnId, item.reason])).toEqual([
      ["Person", "column", "person", undefined],
      ["Date Out", "column", "start", undefined],
      ["Date In", "column", "end", undefined],
      ["Total days", "skip", undefined, "calculated"],
      ["Comments", "add", "added-1", undefined],
      ["Description", "add", "added-2", undefined],
    ]);
    const applied = applyScreenImport(list, table.headers, table.body, assignments);
    expect(applied.blankSkipped).toBe(1);
    expect(applied.dateProblems).toEqual([]);
    expect(applied.addedColumns.map((column) => column.label)).toEqual(["Comments", "Description"]);
    expect(applied.rows[0]).toEqual({
      person: "Nitin",
      start: "2023-01-28",
      end: "2023-01-28",
      "added-1": "",
      "added-2": "Canada by Road",
    });
    expect(applied.rows[1]).toEqual({
      person: "Riddhi",
      start: "2023-08-01",
      end: "2023-09-09",
      "added-1": "N",
      "added-2": "India",
    });
  });

  it("reads workbook date serials as calendar days", async () => {
    const serial = Math.round((Date.UTC(2023, 0, 28) - Date.UTC(1899, 11, 30)) / 86_400_000);
    expect(parseScreenDate(serial)).toBe("2023-01-28");
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Person", "Date Out", "Date In"],
      ["Nitin", serial, serial],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Travel");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const table = splitScreenTable(await tableFromSpreadsheet(buffer, "Travel.xlsx"));
    const applied = applyScreenImport(
      list,
      table.headers,
      table.body,
      suggestScreenImport(list, table.headers),
    );
    expect(applied.rows).toEqual([
      { person: "Nitin", start: "2023-01-28", end: "2023-01-28" },
    ]);
  });

  it("reads a single summary from an older backup", () => {
    const parsed = parseUserScreenJson(
      JSON.stringify({
        ottoList: 1,
        name: "Travel log",
        columns: list.columns,
        summary: { by: "person", sum: "days" },
        rows: [],
      }),
    );
    expect(parsed.summaries).toEqual([{ by: "person", sum: "days" }]);
  });

  it("rejects formula references to missing columns", () => {
    expect(() =>
      parseUserScreenJson(
        JSON.stringify({
          ottoList: 1,
          name: "Bad",
          columns: [{ id: "auto", label: "Auto", type: "auto", a: "x", b: "y" }],
          summary: null,
          rows: [],
        }),
      ),
    ).toThrow("Finish the formula");
  });
});
