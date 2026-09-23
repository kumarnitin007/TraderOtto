"use client";

import { CloudUpload, Database, ShieldCheck } from "lucide-react";

export type VaultMigrationCounts = {
  items: number;
  tags: number;
};

export type VaultMigrationPromptProps = {
  counts: VaultMigrationCounts;
  busy?: boolean;
  error?: string | null;
  onMigrate: () => void;
  onSkip: () => void;
  onDiscard: () => void;
};

export function VaultMigrationPrompt({
  counts,
  busy = false,
  error = null,
  onMigrate,
  onSkip,
  onDiscard,
}: VaultMigrationPromptProps) {
  const { items, tags } = counts;
  const hasLocalData = items > 0 || tags > 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-otto-bg text-otto-text">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-[18px] py-8 pb-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-otto-green-soft text-otto-green">
          <CloudUpload size={28} aria-hidden />
        </div>

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
          One-time migration
        </p>
        <h1 className="text-center text-[26px] font-extrabold tracking-[-0.4px]">
          Move local vault into encryption
        </h1>
        <p className="mt-2 text-center text-[13.5px] leading-relaxed text-otto-text-dim">
          Your vault is set up. We found plaintext prototype data in this browser that can be
          encrypted and uploaded to your account.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-3 rounded-xl bg-otto-surface px-3.5 py-3">
            <Database size={20} className="shrink-0 text-otto-text-dim" aria-hidden />
            <div>
              <b className="block text-[14px]">On this device</b>
              <span className="text-[12.5px] text-otto-text-dim">
                {items} {items === 1 ? "item" : "items"}
                {tags > 0 ? ` · ${tags} ${tags === 1 ? "tag" : "tags"}` : ""} stored as local
                plaintext (IndexedDB prototype).
              </span>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-otto-surface px-3.5 py-3">
            <ShieldCheck size={20} className="shrink-0 text-otto-green" aria-hidden />
            <div>
              <b className="block text-[14px]">After migration</b>
              <span className="text-[12.5px] text-otto-text-dim">
                Each item is encrypted in the browser, then uploaded as ciphertext. Your master
                password never leaves this device.
              </span>
            </div>
          </div>
        </div>

        <div
          role="note"
          className="mt-5 rounded-xl border border-otto-divider px-3.5 py-3 text-[12.5px] leading-relaxed text-otto-text-dim"
        >
          <strong className="font-semibold text-otto-text">Local plaintext is removed only after a successful upload.</strong>{" "}
          If migration fails, your local copy stays so you can retry. For safety, Vault remains
          locked until this plaintext data is migrated.
        </div>

        {!hasLocalData && (
          <p className="mt-4 text-[13px] text-otto-text-dim">
            No local items or tags were found. You can skip and start adding encrypted items.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] font-medium text-otto-red">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onMigrate}
            disabled={busy || !hasLocalData}
            className={`w-full rounded-xl py-3 text-[14px] font-bold ${
              !busy && hasLocalData ? "bg-otto-green text-black" : "bg-otto-surface text-otto-text-faint"
            }`}
            aria-busy={busy}
          >
            {busy ? "Encrypting and uploading…" : "Migrate local vault"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="w-full rounded-xl border border-otto-divider bg-transparent py-3 text-[14px] font-semibold text-otto-text-dim disabled:opacity-60"
          >
            Lock and migrate later
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Permanently delete the local plaintext Vault data from this browser? This cannot be undone."
                )
              ) {
                onDiscard();
              }
            }}
            disabled={busy || !hasLocalData}
            className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-otto-red disabled:opacity-50"
          >
            Permanently delete local plaintext
          </button>
        </div>
      </div>
    </div>
  );
}
