"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { VaultRow } from "@/components/vault/VaultRow";
import type { VaultItem, VaultKind, VaultTag } from "@/lib/vaultRepository";
import type { VaultSecuritySnapshot } from "@/lib/vaultSecurity";
import {
  sortVaultTags,
  tagUsageCount,
  VAULT_TAG_SORT_OPTIONS,
  type VaultTagSort,
} from "@/lib/vaultTagSort";

export type VaultFilter = "all" | VaultKind | "favorites";
type ItemSort = "updated" | "name-asc" | "name-desc" | "category" | "favorites";

export function VaultScreen({
  items,
  allItems,
  query,
  setQuery,
  filter,
  setFilter,
  tags,
  tagFilter,
  setTagFilter,
  browsingTags,
  setBrowsingTags,
  security,
  onSelect,
  onCopy,
  onAdd,
  onOpenHealth,
}: {
  items: VaultItem[];
  allItems: VaultItem[];
  query: string;
  setQuery: (value: string) => void;
  filter: VaultFilter;
  setFilter: (value: VaultFilter) => void;
  tags: VaultTag[];
  tagFilter: string | null;
  setTagFilter: (value: string | null) => void;
  browsingTags: boolean;
  setBrowsingTags: (value: boolean) => void;
  security: VaultSecuritySnapshot;
  onSelect: (item: VaultItem) => void;
  onCopy: (value: string, label?: string) => void;
  onAdd: () => void;
  onOpenHealth: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const [itemSort, setItemSort] = useState<ItemSort>("updated");
  const [tagSort, setTagSort] = useState<VaultTagSort>("name-asc");
  const activeTag = tags.find((tag) => tag.id === tagFilter);
  const showTagGrid = browsingTags && !activeTag;
  const sortedItems = useMemo(() => {
    const next = [...items];
    if (itemSort === "name-asc") return next.sort((a, b) => a.name.localeCompare(b.name));
    if (itemSort === "name-desc") return next.sort((a, b) => b.name.localeCompare(a.name));
    if (itemSort === "category") {
      return next.sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
      );
    }
    if (itemSort === "favorites") {
      return next.sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)
      );
    }
    return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [items, itemSort]);
  const sortedTags = useMemo(
    () => sortVaultTags(tags, allItems, tagSort),
    [tags, tagSort, allItems]
  );

  function toggleTags() {
    if (browsingTags || activeTag) {
      setBrowsingTags(false);
      setTagFilter(null);
    } else {
      setBrowsingTags(true);
      setTagFilter(null);
    }
  }

  function selectFilter(value: VaultFilter) {
    setFilter(value);
    setBrowsingTags(false);
    setTagFilter(null);
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-otto-text-dim">
          {allItems.length} {allItems.length === 1 ? "item" : "items"}
        </p>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add item"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-otto-green text-black"
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5">
        <Search size={20} className="shrink-0 text-otto-text-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your vault"
          className="!border-0 !p-0 text-[15px] font-medium"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-otto-text-faint"
            aria-label="Clear search"
          >
            <X size={17} />
          </button>
        )}
      </label>

      <div className="-mx-[18px] mb-4 flex snap-x items-center gap-2 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip active={filter === "all"} onClick={() => selectFilter("all")}>
          All
        </FilterChip>
        <FilterChip
          active={filter === "favorites"}
          onClick={() => selectFilter("favorites")}
        >
          Favorites
        </FilterChip>
        <button
          type="button"
          onClick={toggleTags}
          className={`inline-flex shrink-0 snap-start items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
            browsingTags || activeTag
              ? "bg-otto-text text-otto-bg"
              : "border border-otto-divider bg-otto-surface text-otto-text-dim"
          }`}
        >
          <Tag size={14} />
          Tags
        </button>
        <FilterChip active={filter === "login"} onClick={() => selectFilter("login")}>
          Passwords
        </FilterChip>
        <FilterChip active={filter === "card"} onClick={() => selectFilter("card")}>
          Cards
        </FilterChip>
        <FilterChip active={filter === "note"} onClick={() => selectFilter("note")}>
          Notes
        </FilterChip>
      </div>

      {!browsingTags && (
        <button
          type="button"
          onClick={onOpenHealth}
          className="mb-5 flex w-full items-center gap-3 rounded-xl bg-otto-surface px-3.5 py-3 text-left"
        >
          <div className="flex items-center gap-1.5 rounded-lg bg-otto-green-soft px-2.5 py-1.5 text-otto-green">
            <ShieldCheck size={18} />
            <strong className="text-lg font-extrabold">{security.score}</strong>
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-[14px]">Vault health is {security.label.toLowerCase()}</b>
            <span className="block truncate text-[12px] text-otto-text-dim">{security.detail}</span>
          </div>
          <ChevronRight size={20} className="shrink-0 text-otto-text-faint" />
        </button>
      )}

      <div className="mb-3 flex items-center justify-between">
        {activeTag ? (
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className="inline-flex items-center gap-1.5 text-left"
          >
            <ArrowLeft size={16} className="text-otto-text-dim" />
            <h2 className="text-[17px] font-bold">{activeTag.name}</h2>
          </button>
        ) : (
          <h2 className="text-[17px] font-bold">
            {showTagGrid
              ? "Browse by Tag"
              : filter === "favorites"
                ? "Favorites"
                : "All items"}
          </h2>
        )}
        {activeTag ? (
          <button
            type="button"
            onClick={toggleTags}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-otto-text-dim"
          >
            <X size={15} />
            Clear
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-otto-text-faint hover:bg-otto-surface"
              aria-label="Sort items"
              aria-expanded={sortOpen}
            >
              <MoreHorizontal size={20} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-otto-divider bg-otto-bg p-1.5 shadow-xl">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-otto-text-faint">
                  Sort by
                </p>
                {showTagGrid ? (
                  <>
                    {VAULT_TAG_SORT_OPTIONS.map((option) => (
                      <SortOption
                        key={option.value}
                        active={tagSort === option.value}
                        label={option.label}
                        onClick={() => {
                          setTagSort(option.value);
                          setSortOpen(false);
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    {(
                      [
                        ["updated", "Recently updated"],
                        ["name-asc", "Name A–Z"],
                        ["name-desc", "Name Z–A"],
                        ["category", "Category"],
                        ["favorites", "Favorites first"],
                      ] as [ItemSort, string][]
                    ).map(([value, label]) => (
                      <SortOption
                        key={value}
                        active={itemSort === value}
                        label={label}
                        onClick={() => {
                          setItemSort(value);
                          setSortOpen(false);
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showTagGrid ? (
        <div className="flex flex-col gap-2">
          {sortedTags.map((tag) => {
            const count = tagUsageCount(allItems, tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTagFilter(tag.id)}
                className="flex items-center gap-3 rounded-xl border border-otto-divider bg-otto-surface px-3 py-3 text-left"
              >
                <i
                  className="block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <b className="min-w-0 flex-1 truncate text-[14px]">{tag.name}</b>
                <small className="text-[11.5px] text-otto-text-dim">
                  {count} {count === 1 ? "item" : "items"}
                </small>
              </button>
            );
          })}
          {!tags.length && (
            <div className="rounded-xl bg-otto-surface px-4 py-10 text-center">
              <Tag className="mx-auto text-otto-text-faint" />
              <h3 className="mt-3 font-bold">No tags yet</h3>
              <p className="mt-1 text-sm text-otto-text-dim">Create tags in Settings.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedItems.map((item) => (
            <VaultRow
              key={item.id}
              item={item}
              tags={tags}
              onSelect={onSelect}
              onCopy={onCopy}
            />
          ))}
          {!items.length && (
            <div className="rounded-xl bg-otto-surface px-4 py-10 text-center">
              <Search className="mx-auto text-otto-text-faint" />
              <h3 className="mt-3 font-bold">No items found</h3>
              <p className="mt-1 text-sm text-otto-text-dim">
                Try another search, category, or tag.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SortOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium hover:bg-otto-surface"
    >
      <span className="flex-1">{label}</span>
      {active && <Check size={15} className="text-otto-green" />}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 snap-start rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
        active
          ? "bg-otto-text text-otto-bg"
          : "border border-otto-divider bg-otto-surface text-otto-text-dim"
      }`}
    >
      {children}
    </button>
  );
}
