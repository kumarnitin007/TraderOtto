"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ItemEditor } from "@/components/vault/ItemEditor";
import { ItemSheet } from "@/components/vault/ItemSheet";
import { PasswordGenerator } from "@/components/vault/PasswordGenerator";
import { RecentlyDeleted } from "@/components/vault/RecentlyDeleted";
import { SecurityScreen } from "@/components/vault/SecurityScreen";
import { SettingsScreen } from "@/components/vault/SettingsScreen";
import { TagManager } from "@/components/vault/TagManager";
import { VaultDataTransfer } from "@/components/vault/VaultDataTransfer";
import { VaultBottomNav, type VaultTab } from "@/components/vault/VaultBottomNav";
import { VaultScreen, type VaultFilter } from "@/components/vault/VaultScreen";
import { tagPalette } from "@/lib/vaultItemTypes";
import {
  vaultRepository,
  type VaultItem,
  type VaultTag,
} from "@/lib/vaultRepository";
import { analyzeVaultSecurity } from "@/lib/vaultSecurity";

type Editor = { mode: "create" } | { mode: "edit"; item: VaultItem };

export function VaultWorkspace() {
  const [tab, setTab] = useState<VaultTab>("vault");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [tags, setTags] = useState<VaultTag[]>([]);
  const [deletedItems, setDeletedItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VaultFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [browsingTags, setBrowsingTags] = useState(false);
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [generator, setGenerator] = useState(false);
  const [tagManager, setTagManager] = useState(false);
  const [dataTransfer, setDataTransfer] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    void vaultRepository.list().then(setItems);
    void vaultRepository.listDeleted().then(setDeletedItems);
    void vaultRepository.listTags().then(setTags);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const security = useMemo(() => analyzeVaultSecurity(items), [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchesText = `${item.name} ${item.username ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesType =
          filter === "all" ||
          (filter === "favorites" ? item.favorite : item.kind === filter);
        const matchesTag = !tagFilter || item.tags.includes(tagFilter);
        return matchesText && matchesType && matchesTag;
      }),
    [items, query, filter, tagFilter]
  );

  async function copy(value: string, label = "Copied") {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setToast(label);
  }

  async function saveItem(item: VaultItem) {
    const saved = { ...item, updatedAt: new Date().toISOString() };
    await vaultRepository.save(saved);
    setItems((current) => {
      const exists = current.some((candidate) => candidate.id === saved.id);
      return exists
        ? current.map((candidate) => (candidate.id === saved.id ? saved : candidate))
        : [saved, ...current];
    });
    setEditor(null);
    setSelected(null);
    setToast("Saved locally");
  }

  async function removeItem(id: string) {
    await vaultRepository.remove(id);
    const removed = items.find((item) => item.id === id);
    setItems((current) => current.filter((item) => item.id !== id));
    if (removed) {
      setDeletedItems((current) => [
        { ...removed, deletedAt: new Date().toISOString() },
        ...current,
      ]);
    }
    setSelected(null);
    setToast("Item deleted");
  }

  async function createTag(name: string): Promise<VaultTag> {
    const tag: VaultTag = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: tagPalette[tags.length % tagPalette.length],
    };
    await vaultRepository.saveTag(tag);
    setTags((current) => [...current, tag]);
    return tag;
  }

  async function removeTag(id: string) {
    await vaultRepository.removeTag(id);
    const orphaned = items.filter((item) => item.tags.includes(id));
    const cleaned = orphaned.map((item) => ({
      ...item,
      tags: item.tags.filter((tag) => tag !== id),
    }));
    await Promise.all(cleaned.map((item) => vaultRepository.save(item)));
    setItems((current) =>
      current.map((item) => cleaned.find((candidate) => candidate.id === item.id) ?? item)
    );
    setTags((current) => current.filter((tag) => tag.id !== id));
    if (tagFilter === id) setTagFilter(null);
    setToast("Tag deleted");
  }

  async function importData(importedItems: VaultItem[], newTags: VaultTag[]) {
    await Promise.all([
      ...newTags.map((tag) => vaultRepository.saveTag(tag)),
      ...importedItems.map((item) => vaultRepository.save(item, "import")),
    ]);
    setTags((current) => {
      const merged = new Map(current.map((tag) => [tag.id, tag]));
      newTags.forEach((tag) => merged.set(tag.id, tag));
      return [...merged.values()];
    });
    setItems((current) => {
      const merged = new Map(current.map((item) => [item.id, item]));
      importedItems.forEach((item) => merged.set(item.id, item));
      return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
    setToast(
      `Imported ${importedItems.length} ${importedItems.length === 1 ? "item" : "items"}`
    );
  }

  async function restoreItem(item: VaultItem) {
    const restored = await vaultRepository.restore(item.id);
    if (!restored) return;
    setDeletedItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setItems((current) => [restored, ...current]);
    setToast("Item restored");
  }

  async function purgeItem(item: VaultItem) {
    await vaultRepository.purge(item.id);
    setDeletedItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setToast("Item permanently deleted");
  }

  return (
    <div className="mx-auto max-w-[720px] pb-28">
      {tab === "vault" && (
        <VaultScreen
          items={filtered}
          allItems={items}
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          tags={tags}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          browsingTags={browsingTags}
          setBrowsingTags={setBrowsingTags}
          security={security}
          onSelect={setSelected}
          onCopy={copy}
          onAdd={() => setEditor({ mode: "create" })}
          onOpenHealth={() => setTab("security")}
        />
      )}
      {tab === "security" && (
        <SecurityScreen security={security} onGenerate={() => setGenerator(true)} />
      )}
      {tab === "settings" && (
        <SettingsScreen
          tagCount={tags.length}
          onManageTags={() => setTagManager(true)}
          onDataTransfer={() => setDataTransfer(true)}
          deletedCount={deletedItems.length}
          onRecentlyDeleted={() => setRecentlyDeleted(true)}
        />
      )}

      <VaultBottomNav
        tab={tab}
        onTab={setTab}
        securityBadge={security.weakCount}
      />

      {selected && (
        <ItemSheet
          item={selected}
          tags={tags}
          onClose={() => setSelected(null)}
          onCopy={copy}
          onEdit={() => {
            setEditor({ mode: "edit", item: selected });
            setSelected(null);
          }}
          onDelete={() => void removeItem(selected.id)}
          onFavorite={() => void saveItem({ ...selected, favorite: !selected.favorite })}
        />
      )}
      {editor && (
        <ItemEditor
          item={editor.mode === "edit" ? editor.item : undefined}
          tags={tags}
          onClose={() => setEditor(null)}
          onSave={(item) => void saveItem(item)}
        />
      )}
      {generator && (
        <PasswordGenerator onClose={() => setGenerator(false)} onCopy={copy} />
      )}
      {tagManager && (
        <TagManager
          tags={tags}
          items={items}
          onCreate={createTag}
          onRemove={(id) => void removeTag(id)}
          onClose={() => setTagManager(false)}
        />
      )}
      {dataTransfer && (
        <VaultDataTransfer
          items={items}
          tags={tags}
          onClose={() => setDataTransfer(false)}
          onImport={importData}
        />
      )}
      {recentlyDeleted && (
        <RecentlyDeleted
          items={deletedItems}
          onClose={() => setRecentlyDeleted(false)}
          onRestore={restoreItem}
          onDeleteForever={purgeItem}
        />
      )}
      {toast && (
        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-otto-surface px-4 py-2 text-[13px] font-semibold shadow-lg desk:bottom-8">
          <ShieldCheck size={18} className="text-otto-green" />
          {toast}
        </div>
      )}
    </div>
  );
}
