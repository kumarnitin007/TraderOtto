import { describe, expect, it } from "vitest";
import { billDueThisMonth, billWhen, dueThisMonthTotal } from "@/lib/bills";
import type { Bill } from "@/types/bill";

function bill(patch: Partial<Bill>): Bill {
  return {
    id: "1",
    name: "Water",
    amount: 10,
    dueDay: 1,
    dueDay2: null,
    dueMonth: null,
    dueSet: true,
    frequency: "monthly",
    category: "other",
    paidMonth: null,
    ...patch,
  };
}

describe("bills", () => {
  const september = new Date(2026, 8, 29);

  it("counts a yearly bill only in its due month", () => {
    const hoa = bill({ frequency: "yearly", dueMonth: 4, dueDay: 1 });
    expect(billDueThisMonth(hoa, september)).toBe(false);
    expect(billDueThisMonth(hoa, new Date(2026, 3, 1))).toBe(true);
    expect(billDueThisMonth(bill({ frequency: "yearly" }), september)).toBe(false);
  });

  it("describes a due date only when one was set", () => {
    expect(billWhen(bill({ frequency: "yearly", dueMonth: 4, dueDay: 1, dueSet: true }))).toBe("due Apr 1");
    expect(billWhen(bill({ dueSet: false }))).toBe("no due day yet");
    expect(billWhen(bill({ frequency: "semimonthly", dueDay: 15, dueDay2: 1, dueSet: true }))).toBe(
      "due the 1 and 15"
    );
  });

  it("leaves yearly bills out of this month's total", () => {
    const september = new Date(2026, 8, 29);
    const rows = [
      bill({ id: "installment", amount: 1900, frequency: "monthly" }),
      bill({ id: "tax", amount: 9200, frequency: "yearly" }),
      bill({ id: "hoa", amount: 300, frequency: "yearly", dueMonth: 4 }),
    ];
    expect(dueThisMonthTotal(rows, september)).toBe(1900);
  });

  it("counts every-other-month bills on the matching months", () => {
    const medical = bill({ frequency: "bimonthly", dueMonth: 9 });
    expect(billDueThisMonth(medical, september)).toBe(true);
    expect(billDueThisMonth(medical, new Date(2026, 9, 1))).toBe(false);
  });
});
