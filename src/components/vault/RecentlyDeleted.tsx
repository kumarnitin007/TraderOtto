"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, Trash2, X } from "lucide-react";
import { kindMeta } from "@/lib/vaultItemTypes";
import type { VaultItem } from "@/lib/vaultRepository";

export function RecentlyDeleted({
  items,
  onClose,
  onRestore,
  onDeleteForever,
}: {
  items: VaultItem[];
  onClose: () => void;
  onRestore: (item: VaultItem) => void | Promise<void>;
  onDeleteForever: (item: VaultItem) => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")
      ),
    [items]
  );

  async function restore(item: VaultItem) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await onRestore(item);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteForever(item: VaultItem) {
    if (busyId) return;
    const ok = window.confirm(
      `Permanently delete "${item.name}"? This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(item.id);
    try {
      await onDeleteForever(item);
    } finally {
      setBusyId(null);
    }
  }

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
        <b className="text-[15px] font-bold">Recently deleted</b>
        <span className="w-9" />
      </header>

      <div className="mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-[18px] py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
          Trash
        </p>
        <h1 className="mb-4 text-[24px] font-extrabold">Recently deleted</h1>
        <p className="mb-5 text-[14px] leading-relaxed text-otto-text-dim">
          Deleted items stay here until you restore them to your vault or remove them
          permanently. Permanent deletion cannot be undone.
        </p>

        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <DeletedRow
              key={item.id}
              item={item}
              busy={busyId === item.id}
              disabled={busyId !== null && busyId !== item.id}
              onRestore={() => void restore(item)}
              onDeleteForever={() => void deleteForever(item)}
            />
          ))}

          {!sorted.length && (
            <div className="rounded-xl bg-otto-surface px-4 py-10 text-center">
              <Trash2 className="mx-auto text-otto-text-faint" size={28} />
              <h3 className="mt-3 font-bold">Nothing in trash</h3>
              <p className="mt-1 text-sm text-otto-text-dim">
                Deleted vault items will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeletedRow({
  item,
  busy,
  disabled,
  onRestore,
  onDeleteForever,
}: {
  item: VaultItem;
  busy: boolean;
  disabled: boolean;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const meta = kindMeta(item.kind);
  const Icon = meta.icon;
  const subtitle = item.username?.trim() || meta.title;
  const deletedLabel = item.deletedAt
    ? formatDeletedDate(item.deletedAt)
    : "Unknown date";

  return (
    <article className="rounded-xl bg-otto-surface px-3 py-3">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: item.color }}
        >
          <Icon size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold">{item.name}</b>
          <span className="block truncate text-[12.5px] text-otto-text-dim">
            {subtitle}
          </span>
          <small className="mt-1 block text-[12px] text-otto-text-faint">
            Deleted {deletedLabel}
          </small>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled || busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-otto-divider bg-otto-bg py-2.5 text-[14px] font-semibold disabled:opacity-40 sm:flex-none sm:px-4"
        >
          <ArchiveRestore size={16} />
          {busy ? "Working…" : "Restore"}
        </button>
        <button
          type="button"
          onClick={onDeleteForever}
          disabled={disabled || busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold text-otto-red hover:bg-otto-red/10 disabled:opacity-40 sm:flex-none sm:px-4"
        >
          <Trash2 size={16} />
          Delete forever
        </button>
      </div>
    </article>
  );
}

function formatDeletedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
