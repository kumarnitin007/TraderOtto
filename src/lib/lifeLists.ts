import { isoDay } from "@/lib/lifeTasks";
import type { LifeListItem } from "@/types/life";

export function dueListItems(items: LifeListItem[], today = new Date()) {
  const todayIso = isoDay(today);
  return items
    .filter((item) => !item.done && item.dueOn && item.dueOn <= todayIso)
    .sort((left, right) => (left.dueOn ?? "").localeCompare(right.dueOn ?? "") || left.text.localeCompare(right.text));
}
