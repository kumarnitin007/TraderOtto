"use client";

import {
  Clock3,
  Heart,
  Import,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { SettingsRow } from "@/components/settings/SettingsPrimitives";

export function SettingsScreen({
  tagCount,
  onManageTags,
  onDataTransfer,
  deletedCount,
  onRecentlyDeleted,
  recentCount,
  onClearRecents,
  onSecurity,
  autoLockMinutes,
}: {
  tagCount: number;
  onManageTags: () => void;
  onDataTransfer: () => void;
  deletedCount: number;
  onRecentlyDeleted: () => void;
  recentCount: number;
  onClearRecents: () => void;
  onSecurity: () => void;
  autoLockMinutes: number;
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
        <SettingsRow
          icon={KeyRound}
          label="Change master password"
          onClick={onSecurity}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={ShieldCheck}
          label="Privacy & security"
          onClick={onSecurity}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={RefreshCw}
          label="Auto-lock"
          detail={`${autoLockMinutes} min`}
          onClick={onSecurity}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Trash2}
          label="Recently deleted"
          detail={`${deletedCount} ${deletedCount === 1 ? "item" : "items"}`}
          onClick={onRecentlyDeleted}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Clock3}
          label="Clear recently opened"
          detail={
            recentCount
              ? `${recentCount} ${recentCount === 1 ? "entry" : "entries"}`
              : "Empty"
          }
          onClick={recentCount ? onClearRecents : undefined}
        />
      </div>
      <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-otto-text-faint">
        The recent list stays on this device and is never synced.
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow icon={Sparkles} label="Suggest an idea" />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow icon={Heart} label="About Otto Vault" detail="Encrypted sync" />
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-otto-text-faint">
        Vault secrets are encrypted in this browser before they are sent to Supabase.
      </p>
    </section>
  );
}
