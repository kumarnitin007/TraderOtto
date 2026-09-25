"use client";

import type { ReactNode } from "react";
import { ChevronRight, X, type LucideIcon } from "lucide-react";

export function SettingsRow({
  icon: Icon,
  label,
  detail,
  onClick,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${
        onClick ? "hover:bg-otto-surface-raise" : "opacity-70"
      }`}
    >
      <Icon size={18} className="shrink-0 text-otto-text-dim" />
      <span className="min-w-0 flex-1 text-[14px] font-medium">{label}</span>
      {detail && (
        <small className="max-w-[45%] truncate text-[12px] text-otto-text-faint">
          {detail}
        </small>
      )}
      {trailing ?? (onClick ? <ChevronRight size={18} className="text-otto-text-faint" /> : null)}
    </button>
  );
}

export function SettingsDetailScreen({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-otto-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-otto-divider px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <b className="text-[15px] font-bold">{title}</b>
        <span className="w-9" />
      </header>
      <div className="mx-auto w-full max-w-[760px] flex-1 overflow-y-auto px-[18px] py-4 pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
          {eyebrow}
        </p>
        <h1 className="mb-5 text-[24px] font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
