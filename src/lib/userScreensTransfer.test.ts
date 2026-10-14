import { describe, expect, it } from "vitest";
import {
  parseUserScreenCsv,
  parseUserScreenJson,
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
  summary: { by: "person", sum: "days" },
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
      summary: list.summary,
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
