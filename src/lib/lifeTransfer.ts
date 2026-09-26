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
