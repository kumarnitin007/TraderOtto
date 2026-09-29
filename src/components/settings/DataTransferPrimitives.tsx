"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function DataTransferCard({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  children,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  tone?: "accent" | "neutral";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-otto-surface p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            tone === "accent"
              ? "bg-otto-green-soft text-otto-green"
              : "bg-otto-surface-raise text-otto-text-dim"
          }`}
        >
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">{title}</h2>
          <div className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
            {description}
          </div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DataTransferButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "dashed";
}) {
  const style =
    variant === "primary"
      ? "bg-otto-text text-otto-bg"
      : variant === "dashed"
        ? "border border-dashed border-otto-divider bg-otto-bg text-otto-text-dim"
        : "border border-otto-divider bg-otto-bg text-otto-text-dim";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
}

export function DataTransferChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-[11.5px] font-bold ${
        active ? "bg-otto-text text-otto-bg" : "bg-otto-bg text-otto-text-dim"
      }`}
    >
      {label}
    </button>
  );
}

export function DataTransferNotice({
  children,
  tone = "private",
}: {
  children: ReactNode;
  tone?: "private" | "warning";
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-[11px] leading-relaxed ${
        tone === "warning"
          ? "border border-otto-amber/35 bg-otto-amber-soft text-otto-text-dim"
          : "border border-otto-divider text-otto-text-faint"
      }`}
    >
      {children}
    </div>
  );
}
