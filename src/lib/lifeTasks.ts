import { parseCsv } from "@/lib/booksTransfer";
import type { LifeTask, LifeTaskCheck, LifeTaskInput } from "@/types/life";

export function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function daysAgo(date: Date, count: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() - count);
  return next;
}

export function weekStartMonday(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return start;
}

export function lifeTaskKey(task: Pick<LifeTask, "name">) {
  return task.name.trim().toLowerCase();
}

export function taskProgress(
  task: Pick<LifeTask, "id" | "cadence" | "targetCount">,
  checks: Pick<LifeTaskCheck, "taskId" | "doneOn">[],
  today = new Date(),
) {
  const todayIso = isoDay(today);
  const doneToday = checks.some((check) => check.taskId === task.id && check.doneOn === todayIso);
  if (task.cadence === "daily") {
    return {
      doneToday,
      count: doneToday ? 1 : 0,
      target: 1,
      label: doneToday ? "Done today" : "Not done today",
    };
  }
  const start = isoDay(weekStartMonday(today));
  const endDate = weekStartMonday(today);
  endDate.setDate(endDate.getDate() + 6);
  const end = isoDay(endDate);
  const count = checks.filter(
    (check) => check.taskId === task.id && check.doneOn >= start && check.doneOn <= end,
  ).length;
  return {
    doneToday,
    count,
    target: task.targetCount,
    label: `${count} of ${task.targetCount} this week`,
  };
}

export function recentDayDots(
  taskId: string,
  checks: Pick<LifeTaskCheck, "taskId" | "doneOn">[],
  today = new Date(),
) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = daysAgo(today, 6 - index);
    const doneOn = isoDay(day);
    return {
      doneOn,
      done: checks.some((check) => check.taskId === taskId && check.doneOn === doneOn),
    };
  });
}

function taskFromRow(row: Record<string, string>): LifeTaskInput | null {
  const name = (row.name ?? "").trim();
  if (!name) return null;
  const frequency = (row.frequency ?? "").trim().toLowerCase();
  const notes = (row.description ?? "").trim().slice(0, 2000);
  if (frequency === "daily") {
    return { name: name.slice(0, 160), notes, cadence: "daily", targetCount: 1 };
  }
  if (frequency === "count-based" && (row.frequencyperiod ?? "").trim().toLowerCase() === "week") {
    const count = Number(row.frequencycount);
    const targetCount = Number.isInteger(count) ? Math.min(7, Math.max(1, count)) : 1;
    return { name: name.slice(0, 160), notes, cadence: "weekly", targetCount };
  }
  return null;
}

export function parseLeoTasks(text: string) {
  const section = text.split(/###\s*Tasks\s*###/i)[1]?.split(/###\s+/)[0] ?? "";
  const table = parseCsv(section);
  const headers = (table[0] ?? []).map((header) => header.trim().toLowerCase());
  const seen = new Set<string>();
  const tasks: LifeTaskInput[] = [];
  for (const cells of table.slice(1)) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    const task = taskFromRow(row);
    if (!task) continue;
    const key = lifeTaskKey(task);
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push(task);
  }
  return tasks;
}
