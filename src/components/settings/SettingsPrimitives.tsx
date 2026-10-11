"use client";

import type { ReactNode } from "react";
import { ChevronRight, X, type LucideIcon } from "lucide-react";

export function SettingsPageHeader({
  eyebrow,
  title = "Settings",
  description,
}: {
  eyebrow: string;
  title?: string;
  description?: ReactNode;
}) {
  return (
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        {eyebrow}
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">{title}</h1>
      {description && (
        <div className="mt-0.5 text-[13px] leading-relaxed text-otto-text-dim">
          {description}
        </div>
      )}
    </header>
  );
}

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

export function SettingsInfoRow({
  icon: Icon,
  label,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
      <Icon size={18} className="shrink-0 text-otto-text-dim" />
      <span className="min-w-0 flex-1 text-[14px] font-medium">{label}</span>
      {detail && (
        <small className="max-w-[55%] text-right text-[12px] text-otto-text-faint">
          {detail}
        </small>
      )}
    </div>
  );
}

export function SettingsSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-otto-green" : "bg-otto-divider"
      }`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function SettingsToggleRow({
  label,
  detail,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
      {Icon && <Icon size={18} className="shrink-0 text-otto-text-dim" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-otto-text-faint">
            {detail}
          </span>
        )}
      </span>
      <SettingsSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function SettingsGroup({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title && (
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl bg-otto-surface">{children}</div>
    </section>
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
