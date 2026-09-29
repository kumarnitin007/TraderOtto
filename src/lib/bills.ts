import type { Bill, BillCategory, BillFrequency } from "@/types/bill";

export const BILL_CATEGORY_LABEL: Record<BillCategory, string> = {
  water: "Water",
  electric: "Electric",
  credit_card: "Credit card",
  mortgage: "Mortgage",
  other: "Other",
};

export const BILL_FREQUENCY_LABEL: Record<BillFrequency, string> = {
  monthly: "Monthly",
  semimonthly: "Twice a month",
  bimonthly: "Every other month",
  yearly: "Yearly",
};

export const BILL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function dueThisMonth(dueDay: number, today = new Date()) {
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, last));
}

/** Yearly bills count in their month. Every-other-month bills count on that month and every second month after. */
export function billDueThisMonth(bill: Pick<Bill, "frequency" | "dueMonth">, today = new Date()) {
  const month = today.getMonth() + 1;
  if (bill.frequency === "yearly") return bill.dueMonth === month;
  if (bill.frequency === "bimonthly") {
    if (!bill.dueMonth) return true;
    return (month - bill.dueMonth + 12) % 2 === 0;
  }
  return true;
}

export function billWhen(bill: Pick<Bill, "frequency" | "dueDay" | "dueDay2" | "dueMonth" | "dueSet">) {
  const month = bill.dueMonth ? BILL_MONTHS[bill.dueMonth - 1] : "";
  if (bill.frequency === "semimonthly" && bill.dueSet && bill.dueDay2) {
    const [first, second] = [bill.dueDay, bill.dueDay2].sort((left, right) => left - right);
    return `due the ${first} and ${second}`;
  }
  if (bill.frequency === "yearly" && month && bill.dueSet) return `due ${month} ${bill.dueDay}`;
  if (bill.frequency === "yearly" && month) return `due in ${month}`;
  if (bill.frequency === "bimonthly" && month && bill.dueSet) return `due the ${bill.dueDay}, ${month} and every other month`;
  if (bill.dueSet) return `due the ${bill.dueDay}`;
  return "no due day yet";
}

/** The next due day still ahead this month, or the latest one if both have passed. */
export function activeDueDay(bill: Pick<Bill, "frequency" | "dueDay" | "dueDay2">, today = new Date()) {
  const days = [bill.dueDay, bill.frequency === "semimonthly" ? bill.dueDay2 : null].filter(
    (day): day is number => typeof day === "number" && day >= 1
  );
  const upcoming = days.filter((day) => day >= today.getDate()).sort((left, right) => left - right)[0];
  return upcoming ?? [...days].sort((left, right) => right - left)[0] ?? bill.dueDay;
}

export function billStatus(bill: Bill, today = new Date()) {
  const due = dueThisMonth(activeDueDay(bill, today), today);
  const paid = bill.paidMonth === monthKey(today);
  const active = billDueThisMonth(bill, today);
  const days = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  return { due, paid, days, active };
}

export type BillSort = "due" | "amount" | "name";
export type BillListFilter = "all" | "month" | BillFrequency;

export function orderedBills(bills: Bill[], sort: BillSort = "due") {
  return [...bills].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "amount") return (right.amount ?? -1) - (left.amount ?? -1) || left.name.localeCompare(right.name);
    return left.dueDay - right.dueDay || left.name.localeCompare(right.name);
  });
}

export function billsForList(bills: Bill[], filter: BillListFilter, sort: BillSort, today = new Date()) {
  const matched = bills.filter((bill) => {
    if (filter === "all") return true;
    if (filter === "month") return billDueThisMonth(bill, today);
    return bill.frequency === filter;
  });
  return orderedBills(matched, sort);
}

/** Unpaid amounts that actually fall in this month. Yearly bills count only in their month. */
export function dueThisMonthTotal(bills: Bill[], today = new Date()) {
  return bills.reduce((sum, bill) => {
    const status = billStatus(bill, today);
    return status.active && !status.paid ? sum + (bill.amount ?? 0) : sum;
  }, 0);
}
