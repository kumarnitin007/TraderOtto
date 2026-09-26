"use client";

import { Copy, Star } from "lucide-react";
import { kindMeta } from "@/lib/vaultItemTypes";
import type { VaultItem } from "@/lib/vaultRepository";

export function VaultRow({
  item,
  onSelect,
  onCopy,
}: {
  item: VaultItem;
  onSelect: (item: VaultItem) => void;
  onCopy: (value: string, label?: string) => void;
}) {
  const Icon = kindMeta(item.kind).icon;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl bg-otto-surface px-3 py-3 transition-colors hover:bg-otto-surface-raise"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: item.color }}
      >
        <Icon size={21} />
      </div>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold">{item.name}</b>
        <span className="block truncate text-[12.5px] text-otto-text-dim">
          {item.username || item.note || "—"}
        </span>
      </div>
      {item.favorite && (
        <Star size={15} className="shrink-0 text-otto-amber" fill="currentColor" />
      )}
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-otto-text-dim hover:bg-otto-bg hover:text-otto-text"
        onClick={(event) => {
          event.stopPropagation();
          onCopy(
            item.password || item.username || item.note || "",
            item.password ? "Password copied" : "Copied"
          );
        }}
        aria-label="Copy"
      >
        <Copy size={19} />
      </button>
    </article>
  );
}
