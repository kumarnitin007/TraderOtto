"use client";

import type { ReactNode } from "react";
import {
  ChevronRight,
  Fingerprint,
  Heart,
  Import,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

function SettingsRow({
  icon: Icon,
  label,
  detail,
  onClick,
  trailing,
}: {
  icon: typeof Tag;
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
      <span className="flex-1 text-[14px] font-medium">{label}</span>
      {detail && <small className="text-[12px] text-otto-text-faint">{detail}</small>}
      {trailing ?? (onClick ? <ChevronRight size={18} className="text-otto-text-faint" /> : null)}
    </button>
  );
}

export function SettingsScreen({
  tagCount,
  onManageTags,
  onDataTransfer,
  deletedCount,
  onRecentlyDeleted,
}: {
  tagCount: number;
  onManageTags: () => void;
  onDataTransfer: () => void;
  deletedCount: number;
  onRecentlyDeleted: () => void;
}) {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Make it yours
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Settings</h1>

      <div className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow icon={Tag} label="Tags" detail={`${tagCount} tags`} onClick={onManageTags} />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Import}
          label="Import & export"
          detail="CSV"
          onClick={onDataTransfer}
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow icon={Fingerprint} label="Unlock with biometrics" trailing={<TogglePlaceholder />} />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow icon={KeyRound} label="Change master password" />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow icon={ShieldCheck} label="Privacy & security" />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow icon={RefreshCw} label="Auto-lock" detail="Coming soon" />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Trash2}
          label="Recently deleted"
          detail={`${deletedCount} ${deletedCount === 1 ? "item" : "items"}`}
          onClick={onRecentlyDeleted}
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow icon={Sparkles} label="Suggest an idea" />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow icon={Heart} label="About Otto Vault" detail="Prototype" />
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-otto-text-faint">
        Appearance and workspace switching live in the Otto shell. Encrypted sync arrives with
        Supabase.
      </p>
    </section>
  );
}

function TogglePlaceholder() {
  return (
    <span
      className="relative inline-flex h-6 w-10 shrink-0 rounded-full bg-otto-divider"
      aria-hidden
    >
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-otto-text-faint" />
    </span>
  );
}
