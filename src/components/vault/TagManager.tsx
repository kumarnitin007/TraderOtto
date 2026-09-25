"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Tag, Trash2, X } from "lucide-react";
import type { VaultItem, VaultTag } from "@/lib/vaultRepository";
import {
  sortVaultTags,
  tagUsageCount,
  VAULT_TAG_SORT_OPTIONS,
  type VaultTagSort,
} from "@/lib/vaultTagSort";

export function TagManager({
  tags,
  items,
  onCreate,
  onRemove,
  onClose,
}: {
  tags: VaultTag[];
  items: VaultItem[];
  onCreate: (name: string) => Promise<VaultTag>;
  onRemove: (id: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [sort, setSort] = useState<VaultTagSort>("name-asc");
  const [pendingDelete, setPendingDelete] = useState<VaultTag | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sortedTags = useMemo(() => sortVaultTags(tags, items, sort), [tags, items, sort]);
  const pendingCount = pendingDelete ? tagUsageCount(items, pendingDelete.id) : 0;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate(name);
    setName("");
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const removed = await onRemove(pendingDelete.id);
    setDeleting(false);
    if (removed) setPendingDelete(null);
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
        <b className="text-[15px] font-bold">Tags</b>
        <span className="w-9" />
      </header>

      <div className="mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-[18px] py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
          Organize your vault
        </p>
        <h1 className="mb-4 text-[24px] font-extrabold">Manage tags</h1>

        <form onSubmit={create} className="mb-5 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New tag name"
            className="flex-1 rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 !text-[15px]"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-otto-green text-black disabled:opacity-40"
            aria-label="Add tag"
          >
            <Plus size={17} />
          </button>
        </form>

        {tags.length > 0 && (
          <div
            className="-mx-[18px] mb-3 flex snap-x gap-2 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Sort tags"
          >
            {VAULT_TAG_SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                className={`shrink-0 snap-start rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                  sort === option.value
                    ? "bg-otto-text text-otto-bg"
                    : "border border-otto-divider bg-otto-surface text-otto-text-dim"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {sortedTags.map((tag) => {
            const count = tagUsageCount(items, tag.id);
            return (
              <div
                key={tag.id}
                className="flex items-center gap-3 rounded-xl bg-otto-surface px-3 py-3"
              >
                <i
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <b className="flex-1 text-[14px]">{tag.name}</b>
                <small className="text-[12px] text-otto-text-dim">
                  {count} {count === 1 ? "item" : "items"}
                </small>
                <button
                  type="button"
                  onClick={() => setPendingDelete(tag)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-otto-text-dim hover:bg-otto-bg hover:text-otto-red"
                  aria-label={`Delete ${tag.name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
          {!tags.length && (
            <div className="rounded-xl bg-otto-surface px-4 py-10 text-center">
              <Tag className="mx-auto text-otto-text-faint" />
              <h3 className="mt-3 font-bold">No tags yet</h3>
              <p className="mt-1 text-sm text-otto-text-dim">
                Create one to group related items.
              </p>
            </div>
          )}
        </div>
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 desk:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-tag-title"
          aria-describedby="delete-tag-description"
        >
          <div className="w-full max-w-[420px] rounded-2xl border border-otto-divider bg-otto-bg p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <i
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: pendingDelete.color }}
              />
              <h2 id="delete-tag-title" className="text-[18px] font-extrabold">
                Delete “{pendingDelete.name}”?
              </h2>
            </div>
            <p
              id="delete-tag-description"
              className="mt-3 text-[13.5px] leading-relaxed text-otto-text-dim"
            >
              {pendingCount === 0
                ? "This tag is not used by any vault items."
                : `${pendingCount} ${pendingCount === 1 ? "item" : "items"} will stay in your vault. This tag will be removed from ${pendingCount === 1 ? "it" : "them"}.`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-xl border border-otto-divider px-4 py-3 text-[13px] font-bold text-otto-text-dim disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded-xl bg-otto-red-soft px-4 py-3 text-[13px] font-bold text-otto-red disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
