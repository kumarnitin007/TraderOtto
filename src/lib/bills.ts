import type { Bill, BillCategory } from "@/types/bill";

export const BILL_CATEGORY_LABEL: Record<BillCategory, string> = {
  water: "Water",
  electric: "Electric",
  credit_card: "Credit card",
  mortgage: "Mortgage",
  other: "Other",
};

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function dueThisMonth(dueDay: number, today = new Date()) {
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, last));
}

export function billStatus(bill: Bill, today = new Date()) {
  const due = dueThisMonth(bill.dueDay, today);
  const paid = bill.paidMonth === monthKey(today);
  const days = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  return { due, paid, days };
}

export function orderedBills(bills: Bill[]) {
  return [...bills].sort(
    (left, right) => left.dueDay - right.dueDay || left.name.localeCompare(right.name)
  );
}
