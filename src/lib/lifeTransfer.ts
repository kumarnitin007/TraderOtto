import type { Bill } from "@/types/bill";
import type { LifeItem, LifeList, LifeListItem, LifeTask, LifeTaskCheck } from "@/types/life";

export type LifeExportOptions = {
  dates: boolean;
  habits: boolean;
  habitHistory: boolean;
  todos: boolean;
  bills: boolean;
};

export const DEFAULT_LIFE_EXPORT_OPTIONS: LifeExportOptions = {
  dates: true,
  habits: true,
  habitHistory: true,
  todos: true,
  bills: true,
};

export type LifeExportData = {
  dates: LifeItem[];
  habits: LifeTask[];
  checks: LifeTaskCheck[];
  lists: LifeList[];
  listItems: LifeListItem[];
  bills: Bill[];
};

export function lifeExportJson(data: LifeExportData, options: LifeExportOptions): string {
  const payload: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  if (options.dates) {
    payload.dates = data.dates.map((item) => ({
      name: item.name,
      category: item.category,
      notes: item.notes,
      month: item.month,
      day: item.day,
      year: item.year,
      occursOn: item.occursOn,
      repeats: item.repeats,
      remindDays: item.remindDays,
      milestone: item.milestone,
    }));
  }
  if (options.habits) {
    payload.habits = data.habits.map((task) => ({
      name: task.name,
      notes: task.notes,
      cadence: task.cadence,
      targetCount: task.targetCount,
    }));
  }
  if (options.habitHistory) {
    const names = new Map(data.habits.map((task) => [task.id, task.name]));
    payload.habitHistory = data.checks.map((check) => ({
      habit: names.get(check.taskId) ?? "",
      doneOn: check.doneOn,
    }));
  }
  if (options.todos) {
    payload.todos = data.lists.map((list) => ({
      name: list.name,
      items: data.listItems
        .filter((item) => item.listId === list.id)
        .map((item) => ({
          text: item.text,
          done: item.done,
          dueOn: item.dueOn,
        })),
    }));
  }
  if (options.bills) {
    payload.bills = data.bills.map((bill) => ({
      name: bill.name,
      amount: bill.amount,
      dueDay: bill.dueDay,
      dueDay2: bill.dueDay2,
      dueMonth: bill.dueMonth,
      dueSet: bill.dueSet,
      frequency: bill.frequency,
      category: bill.category,
      paidMonth: bill.paidMonth,
    }));
  }
  return JSON.stringify(payload, null, 2);
}

const CSV_HEADERS = [
  "section",
  "name",
  "list",
  "category",
  "notes",
  "month",
  "day",
  "year",
  "occurs_on",
  "repeats",
  "remind_days",
  "milestone",
  "cadence",
  "target_count",
  "done_on",
  "text",
  "done",
  "due_on",
  "amount",
  "due_day",
  "due_day_2",
  "due_month",
  "frequency",
  "paid_month",
  "due_set",
] as const;

/** One spreadsheet: each row is a date, habit, check, or to-do. */
export function lifeExportCsv(data: LifeExportData, options: LifeExportOptions): string {
  const rows: string[][] = [];
  const cells = (values: string[]) =>
    CSV_HEADERS.map((_, index) => values[index] ?? "");
  if (options.dates) {
    for (const item of data.dates) {
      rows.push(cells([
        "date",
        item.name,
        "",
        item.category,
        item.notes,
        String(item.month),
        String(item.day),
        item.year == null ? "" : String(item.year),
        item.occursOn ?? "",
        item.repeats,
        String(item.remindDays),
        item.milestone ? "true" : "false",
        "",
        "",
        "",
        "",
        "",
        "",
      ]));
    }
  }
  if (options.habits) {
    for (const task of data.habits) {
      rows.push(cells([
        "habit",
        task.name,
        "",
        "",
        task.notes,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        task.cadence,
        String(task.targetCount),
        "",
        "",
        "",
        "",
      ]));
    }
  }
  if (options.habitHistory) {
    const names = new Map(data.habits.map((task) => [task.id, task.name]));
    for (const check of data.checks) {
      rows.push(cells([
        "habit_check",
        names.get(check.taskId) ?? "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        check.doneOn,
        "",
        "",
        "",
      ]));
    }
  }
  if (options.todos) {
    const lists = new Map(data.lists.map((list) => [list.id, list.name]));
    for (const item of data.listItems) {
      rows.push(cells([
        "todo",
        "",
        lists.get(item.listId) ?? "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.text,
        item.done ? "true" : "false",
        item.dueOn ?? "",
      ]));
    }
  }
  if (options.bills) {
    for (const bill of data.bills) {
      rows.push(cells([
        "bill",
        bill.name,
        "",
        bill.category,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        bill.amount == null ? "" : String(bill.amount),
        String(bill.dueDay),
        bill.dueDay2 == null ? "" : String(bill.dueDay2),
        bill.dueMonth == null ? "" : String(bill.dueMonth),
        bill.frequency,
        bill.paidMonth ?? "",
        bill.dueSet ? "true" : "false",
      ]));
    }
  }
  return [CSV_HEADERS.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
