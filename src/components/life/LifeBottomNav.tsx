"use client";

import { CalendarHeart, CheckCheck, Settings, type LucideIcon } from "lucide-react";

export type LifeTab = "dates" | "tasks" | "settings";

const ITEMS: { id: LifeTab; label: string; icon: LucideIcon }[] = [
  { id: "dates", label: "Dates", icon: CalendarHeart },
  { id: "tasks", label: "Tasks", icon: CheckCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

export function LifeBottomNav({ tab, onTab }: { tab: LifeTab; onTab: (tab: LifeTab) => void }) {
  return (
    <nav
      aria-label="Life navigation"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-otto-divider bg-otto-bg/90 px-2 pb-[calc(9px+env(safe-area-inset-bottom))] pt-[9px] backdrop-blur-[14px] desk:static desk:mt-8 desk:rounded-2xl desk:border desk:bg-otto-surface desk:pb-2"
    >
      <div className="mx-auto flex max-w-[720px]">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`flex flex-1 flex-col items-center gap-[3px] px-0 pb-1 pt-1.5 ${
              tab === id ? "text-otto-green" : "text-otto-text-faint"
            }`}
          >
            <Icon size={21} strokeWidth={tab === id ? 2.3 : 1.8} />
            <small className="text-[10.5px] font-semibold">{label}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}
