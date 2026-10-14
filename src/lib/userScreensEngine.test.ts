import { describe, expect, it } from "vitest";
import { evalAuto, evalRow, groupTotals } from "@/lib/userScreensEngine";
import type { UserScreen, UserScreenColumn, UserScreenRow } from "@/types/userScreens";

const person = { id: "person", label: "Person", type: "text" } as const;
const start = { id: "start", label: "Start", type: "date" } as const;
const end = { id: "end", label: "End", type: "date" } as const;
const days: UserScreenColumn = {
  id: "days",
  label: "Days",
  type: "auto",
  a: "end",
  op: "-",
  b: "start",
};
const travel = {
  columns: [person, start, end, days],
  summary: { by: "person", sum: "days" },
} as Pick<UserScreen, "columns" | "summary">;

describe("user screens engine", () => {
  it("calculates exclusive, inclusive, same-day and leap-month date differences", () => {
    expect(evalAuto(travel, { start: "2026-01-03", end: "2026-01-19" }, days)).toEqual({ v: 16 });
    expect(
      evalAuto(travel, { start: "2026-01-03", end: "2026-01-19" }, { ...days, incl: true }),
    ).toEqual({ v: 17 });
    expect(
      evalAuto(travel, { start: "2026-01-03", end: "2026-01-03" }, { ...days, incl: true }),
    ).toEqual({ v: 1 });
    expect(evalAuto(travel, { start: "2028-02-28", end: "2028-03-01" }, days)).toEqual({ v: 2 });
  });

  it("is UTC and DST safe and rejects reversed or missing dates", () => {
    expect(evalAuto(travel, { start: "2026-03-07", end: "2026-03-09" }, days)).toEqual({ v: 2 });
    expect(evalAuto(travel, { start: "2026-05-12", end: "2026-05-02" }, days)).toEqual({
      err: "End is before Start",
    });
    expect(evalAuto(travel, { start: "2026-01-01", end: "" }, days)).toEqual({ err: "Add End" });
    expect(
      evalAuto(
        travel,
        { start: "2026-01-01", end: "" },
        { ...days, today: true },
        new Date(2026, 0, 5),
      ),
    ).toEqual({ v: 4 });
  });

  it("calculates number addition/subtraction and validates operands", () => {
    const a = { id: "a", label: "Amount", type: "number" } as const;
    const b = { id: "b", label: "Tax", type: "number" } as const;
    const total: UserScreenColumn = { id: "total", label: "Total", type: "auto", a: "a", b: "b", op: "+" };
    const list = { columns: [a, b, total] };
    expect(evalAuto(list, { a: "10", b: "2.5" }, total)).toEqual({ v: 12.5 });
    expect(evalAuto(list, { a: "10", b: "2.5" }, { ...total, op: "-" })).toEqual({ v: 7.5 });
    expect(evalAuto(list, { a: "", b: "2" }, total)).toEqual({ err: "Add Amount" });
    expect(evalAuto({ columns: [a, start, total] }, { a: "2", start: "2026-01-01" }, total)).toEqual({
      err: "Fix the formula columns",
    });
  });

  it("skips invalid rows and groups names without case sensitivity", () => {
    const rows = [
      { id: "1", listId: "x", data: { person: "Asha", start: "2026-01-01", end: "2026-01-02" }, createdAt: "", updatedAt: "" },
      { id: "2", listId: "x", data: { person: "asha", start: "2026-01-03", end: "2026-01-05" }, createdAt: "", updatedAt: "" },
      { id: "3", listId: "x", data: { person: "", start: "2026-01-01", end: "2026-01-02" }, createdAt: "", updatedAt: "" },
    ] satisfies UserScreenRow[];
    expect(evalRow(travel, rows[2].data).err).toBe("Add Person");
    const result = groupTotals(travel, rows);
    expect(result.skipped).toBe(1);
    expect(result.counted).toBe(2);
    expect([...result.totals.values()]).toEqual([{ label: "Asha", value: 3 }]);
  });
});
