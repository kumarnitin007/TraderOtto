"use client";

import type { ComponentType, ReactNode } from "react";
import { X } from "lucide-react";

type SheetIcon = ComponentType<{ size?: number; className?: string; fill?: string }>;

/** The one bottom-sheet shell every workspace uses when an entry is tapped. */
export function ActionSheet({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  header,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: SheetIcon;
  iconColor?: string;
  /** Replaces the icon tile, for covers or other custom art. */
  header?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-0 desk:items-center desk:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[720px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-otto-divider desk:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface text-otto-text-dim"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 px-4 pb-2 pt-4">
          {header ??
            (Icon && (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{ backgroundColor: iconColor ?? "rgb(var(--otto-green))" }}
              >
                <Icon size={26} />
              </div>
            ))}
          <div className="min-w-0 pr-8">
            <h2 className="truncate text-xl font-extrabold">{title}</h2>
            {subtitle && (
              <span className="block truncate text-[13px] text-otto-text-dim">{subtitle}</span>
            )}
          </div>
        </div>

        <div className="overflow-y-auto px-2 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function SheetAction({
  icon: Icon,
  label,
  onClick,
  tone,
  filled,
}: {
  icon: SheetIcon;
  label: string;
  onClick: () => void;
  tone?: "danger";
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left text-[16px] font-medium hover:bg-otto-surface ${
        tone === "danger" ? "text-otto-red" : "text-otto-text"
      }`}
    >
      <Icon size={22} fill={filled ? "currentColor" : "none"} className="shrink-0" />
      {label}
    </button>
  );
}
