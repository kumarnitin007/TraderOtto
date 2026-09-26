import { describe, expect, it } from "vitest";
import { lifeExportJson } from "@/lib/lifeTransfer";
import type { LifeItem, LifeList, LifeListItem, LifeTask, LifeTaskCheck } from "@/types/life";

const date: LifeItem = {
  id: "d1",
  name: "Ada",
  category: "birthday",
  notes: "",
  month: 3,
  day: 4,
  year: 2013,
  occursOn: null,
  repeats: "yearly",
  remindDays: 7,
  milestone: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("life export", () => {
  it("includes only the sections that are turned on", () => {
    const text = lifeExportJson(
      {
        dates: [date],
        habits: [
          {
            id: "h1",
            name: "Walk",
            notes: "",
            cadence: "daily",
            targetCount: 1,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          } satisfies LifeTask,
        ],
        checks: [{ id: "c1", taskId: "h1", doneOn: "2026-09-26" } satisfies LifeTaskCheck],
        lists: [
          {
            id: "l1",
            name: "Errands",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          } satisfies LifeList,
        ],
        listItems: [
          {
            id: "i1",
            listId: "l1",
            text: "Call the school",
            done: false,
            dueOn: "2026-09-26",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          } satisfies LifeListItem,
        ],
      },
      { dates: true, habits: false, habitHistory: false, todos: true }
    );
    const parsed = JSON.parse(text) as { dates: unknown[]; habits?: unknown; todos: { name: string }[] };
    expect(parsed.dates).toHaveLength(1);
    expect(parsed.habits).toBeUndefined();
    expect(parsed.todos[0].name).toBe("Errands");
  });
});
