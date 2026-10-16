"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { useScreenOption } from "@/hooks/useScreenOption";
import type { AppWorkspace } from "@/lib/appWorkspace";

export const MODULE_NAV_SLOT_ID = "otto-module-nav";

export type ModuleNavItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

/** Bottom bar on phones; on desktop the same items move into the left panel of the app shell. */
export function ModuleNav<T extends string>({
  workspace,
  label,
  items,
  active,
  onSelect,
}: {
  workspace: AppWorkspace;
  label: string;
  items: ModuleNavItem<T>[];
  active: T | null;
  onSelect: (id: T) => void;
}) {
  const [current] = useScreenOption("appWorkspace");
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(MODULE_NAV_SLOT_ID));
  }, []);

  return (
    <>
      <nav
        aria-label={label}
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-otto-divider bg-otto-bg/90 px-1 pb-[calc(9px+env(safe-area-inset-bottom))] pt-[9px] backdrop-blur-[14px] desk:hidden"
      >
        <div className="mx-auto flex max-w-[720px]">
          {items.map(({ id, label: itemLabel, icon: Icon, badge }) => {
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-[3px] px-0.5 pb-1 pt-1.5 ${
                  selected ? "text-otto-green" : "text-otto-text-faint"
                }`}
              >
                <span className="relative">
                  <Icon size={21} strokeWidth={selected ? 2.3 : 1.8} />
                  {badge != null && badge > 0 && (
                    <em className="absolute -right-2.5 -top-1 min-w-[15px] rounded-full bg-otto-red px-1 text-center text-[9px] font-bold not-italic text-black">
                      {badge}
                    </em>
                  )}
                </span>
                <small className="w-full truncate text-center text-[10.5px] font-semibold">{itemLabel}</small>
              </button>
            );
          })}
        </div>
      </nav>
      {slot &&
        current === workspace &&
        createPortal(
          <nav aria-label={label}>
            {items.map(({ id, label: itemLabel, icon: Icon, badge }) => {
              const selected = active === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelect(id)}
                  className={`mb-0.5 flex w-full items-center gap-[11px] rounded-[10px] px-2 py-2.5 text-left text-[14.5px] font-semibold ${
                    selected ? "bg-otto-surface text-otto-text" : "text-otto-text-dim"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={2.2}
                    className={`shrink-0 ${selected ? "text-otto-green" : "text-otto-text-faint"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{itemLabel}</span>
                  {badge != null && badge > 0 && (
                    <span className="rounded-full bg-otto-red-soft px-1.5 py-0.5 text-[10px] text-otto-red">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>,
          slot
        )}
    </>
  );
}
