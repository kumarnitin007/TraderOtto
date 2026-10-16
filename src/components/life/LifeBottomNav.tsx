"use client";

import {
  CalendarHeart,
  CheckCheck,
  House,
  ListTodo,
  Receipt,
  Settings,
} from "lucide-react";
import { ModuleNav, type ModuleNavItem } from "@/components/nav/ModuleNav";

export type LifeTab = "today" | "dates" | "tasks" | "lists" | "bills" | "settings";

const ITEMS: ModuleNavItem<LifeTab>[] = [
  { id: "today", label: "Today", icon: House },
  { id: "dates", label: "Dates", icon: CalendarHeart },
  { id: "tasks", label: "Habits", icon: CheckCheck },
  { id: "lists", label: "To-dos", icon: ListTodo },
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "settings", label: "Settings", icon: Settings },
];

export function LifeBottomNav({ tab, onTab }: { tab: LifeTab; onTab: (tab: LifeTab) => void }) {
  return <ModuleNav workspace="life" label="Life navigation" items={ITEMS} active={tab} onSelect={onTab} />;
}
