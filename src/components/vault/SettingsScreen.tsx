"use client";

import {
  Clock3,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { OttoPreferencesEntry } from "@/components/settings/OttoPreferences";
import { DataTransferRow } from "@/components/settings/DataTransferPrimitives";
import type { VaultSecuritySection } from "@/components/vault/VaultSecuritySettings";
import {
  SettingsInfoRow,
  SettingsPageHeader,
  SettingsRow,
} from "@/components/settings/SettingsPrimitives";

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
  onSecurity: (section: VaultSecuritySection) => void;
  autoLockMinutes: number;
}) {
  return (
    <section>
      <SettingsPageHeader
        eyebrow="Vault preferences"
        description="Manage organization, privacy, security, and backups."
      />

      <div className="mt-5">
        <OttoPreferencesEntry />
      </div>

      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow icon={Tag} label="Tags" detail={`${tagCount} tags`} onClick={onManageTags} />
        <div className="mx-3.5 border-t border-otto-divider" />
        <DataTransferRow detail="CSV backup" onClick={onDataTransfer} />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={KeyRound}
          label="Change master password"
          onClick={() => onSecurity("password")}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={RefreshCw}
          label="Auto-lock"
          detail={`${autoLockMinutes} min`}
          onClick={() => onSecurity("lock")}
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
        <SettingsInfoRow
          icon={ShieldCheck}
          label="Vault encryption"
          detail="Encrypted before sync"
        />
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-otto-text-faint">
        Vault secrets are encrypted in this browser before they are sent to Supabase.
      </p>
    </section>
  );
}
