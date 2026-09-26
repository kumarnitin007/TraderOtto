import type { LifeItem, LifeList, LifeListItem, LifeTask, LifeTaskCheck } from "@/types/life";

export type LifeExportOptions = {
  dates: boolean;
  habits: boolean;
  habitHistory: boolean;
  todos: boolean;
};

export const DEFAULT_LIFE_EXPORT_OPTIONS: LifeExportOptions = {
  dates: true,
  habits: true,
  habitHistory: true,
  todos: true,
};

export function lifeExportJson(
  data: {
    dates: LifeItem[];
    habits: LifeTask[];
    checks: LifeTaskCheck[];
    lists: LifeList[];
    listItems: LifeListItem[];
  },
  options: LifeExportOptions
): string {
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
] as const;

/** One spreadsheet: each row is a date, habit, check, or to-do. */
export function lifeExportCsv(
  data: {
    dates: LifeItem[];
    habits: LifeTask[];
    checks: LifeTaskCheck[];
    lists: LifeList[];
    listItems: LifeListItem[];
  },
  options: LifeExportOptions
): string {
  const rows: string[][] = [];
  if (options.dates) {
    for (const item of data.dates) {
      rows.push([
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
      ]);
    }
  }
  if (options.habits) {
    for (const task of data.habits) {
      rows.push([
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
      ]);
    }
  }
  if (options.habitHistory) {
    const names = new Map(data.habits.map((task) => [task.id, task.name]));
    for (const check of data.checks) {
      rows.push([
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
      ]);
    }
  }
  if (options.todos) {
    const lists = new Map(data.lists.map((list) => [list.id, list.name]));
    for (const item of data.listItems) {
      rows.push([
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
      ]);
    }
  }
  return [CSV_HEADERS.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
