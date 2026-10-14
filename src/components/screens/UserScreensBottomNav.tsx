"use client";

import { Grid2X2, ListPlus, Settings } from "lucide-react";
import type { UserScreen } from "@/types/userScreens";

export function UserScreensBottomNav({
  lists,
  active,
  onTab,
}: {
  lists: UserScreen[];
  active: string;
  onTab: (tab: string) => void;
}) {
  const tabs = [
    { id: "overview", label: "Overview", icon: Grid2X2 },
    ...lists.map((list) => ({ id: list.id, label: list.name, icon: Grid2X2 })),
    ...(lists.length < 4 ? [{ id: "new", label: "New", icon: ListPlus }] : []),
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <nav
      aria-label="User Screens tabs"
      className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-otto-divider bg-otto-bg/90 px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-[14px] desk:static desk:mt-8 desk:rounded-2xl desk:border desk:bg-otto-surface desk:pb-2"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onTab(tab.id)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-1 ${
              selected ? "text-otto-green" : "text-otto-text-faint"
            }`}
          >
            <Icon size={21} strokeWidth={selected ? 2.3 : 1.8} />
            <span className="w-full truncate text-[10px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
