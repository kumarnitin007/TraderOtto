"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useScreenOption } from "@/hooks/useScreenOption";
import {
  APP_WORKSPACE_META,
  APP_WORKSPACES,
  type AppWorkspace,
} from "@/lib/appWorkspace";

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const [workspace, setWorkspace] = useScreenOption("appWorkspace");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = APP_WORKSPACE_META[workspace];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: AppWorkspace) {
    setWorkspace(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`flex items-center gap-1.5 rounded-full border border-otto-divider bg-otto-surface font-semibold text-otto-text-dim transition-colors hover:bg-otto-surface-raise ${
          compact ? "h-7 px-2 text-[11px]" : "px-3 py-2 text-xs"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Switch app. Current: ${current.label}`}
        title="Switch app"
      >
        <LayoutGrid size={13} />
        {!compact && current.label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-[220px] overflow-hidden rounded-xl border border-otto-divider bg-otto-bg py-1 shadow-2xl"
        >
          {APP_WORKSPACES.map((id) => {
            const item = APP_WORKSPACE_META[id];
            const Icon = item.icon;
            const active = id === workspace;
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                  active ? "bg-otto-surface text-otto-text" : "text-otto-text-dim"
                }`}
              >
                <Icon size={15} className={active ? "text-otto-green" : ""} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className="block text-[10px] text-otto-text-faint">
                    {item.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
