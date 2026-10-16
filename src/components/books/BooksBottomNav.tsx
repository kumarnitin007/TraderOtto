"use client";

import { BarChart3, BookOpen, Compass, Plus, Settings } from "lucide-react";
import { ModuleNav, type ModuleNavItem } from "@/components/nav/ModuleNav";
import type { ScreenOptions } from "@/lib/screenCache";

export type BooksTab = ScreenOptions["booksTab"];

const ITEMS: ModuleNavItem<BooksTab>[] = [
  { id: "library", label: "Library", icon: BookOpen },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "add", label: "Add", icon: Plus },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BooksBottomNav({
  tab,
  onTab,
}: {
  tab: BooksTab;
  onTab: (tab: BooksTab) => void;
}) {
  return <ModuleNav workspace="books" label="Books navigation" items={ITEMS} active={tab} onSelect={onTab} />;
}
