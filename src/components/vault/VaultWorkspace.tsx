"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ItemEditor } from "@/components/vault/ItemEditor";
import { ItemSheet } from "@/components/vault/ItemSheet";
import { PasswordGenerator } from "@/components/vault/PasswordGenerator";
import { RecentlyDeleted } from "@/components/vault/RecentlyDeleted";
import { SecurityScreen } from "@/components/vault/SecurityScreen";
import { SettingsScreen } from "@/components/vault/SettingsScreen";
import { TagManager } from "@/components/vault/TagManager";
import { VaultDataTransfer } from "@/components/vault/VaultDataTransfer";
import { VaultMigrationPrompt } from "@/components/vault/VaultMigrationPrompt";
import { VaultSecuritySettings } from "@/components/vault/VaultSecuritySettings";
import { VaultUnlockScreen } from "@/components/vault/VaultUnlockScreen";
import { VaultBottomNav, type VaultTab } from "@/components/vault/VaultBottomNav";
import { VaultScreen, type VaultFilter } from "@/components/vault/VaultScreen";
import { tagPalette } from "@/lib/vaultItemTypes";
import {
  saveVaultItems,
  type VaultItem,
  type VaultTag,
} from "@/lib/vaultRepository";
import { analyzeVaultSecurity } from "@/lib/vaultSecurity";
import {
  clearVaultRecents,
  readVaultRecents,
  rememberVaultRecent,
} from "@/lib/vaultRecents";
import { useEncryptedVault } from "@/hooks/useEncryptedVault";

type Editor = { mode: "create" } | { mode: "edit"; item: VaultItem };

export function VaultWorkspace() {
  const vault = useEncryptedVault();
  const repository = vault.repository;
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
  const [securitySettings, setSecuritySettings] = useState(false);
  const [toast, setToast] = useState("");
  const [dataError, setDataError] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const clipboardValueRef = useRef("");

  const loadVaultData = useCallback(async () => {
    if (!repository) return;
    try {
      const [nextItems, nextDeleted, nextTags] = await Promise.all([
        repository.list(),
        repository.listDeleted(),
        repository.listTags(),
      ]);
      setItems(nextItems);
      setDeletedItems(nextDeleted);
      setTags(nextTags);
      setDataError("");
    } catch {
      setItems([]);
      setDeletedItems([]);
      setTags([]);
      setDataError(
        "Vault data could not be decrypted or synced. Lock the vault and verify your connection before retrying."
      );
    }
  }, [repository]);

  useEffect(() => {
    if (!repository) {
      setItems([]);
      setDeletedItems([]);
      setTags([]);
      return;
    }
    void loadVaultData();
  }, [repository, loadVaultData]);

  useEffect(() => {
    setRecentIds(readVaultRecents());
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

  function openItem(item: VaultItem) {
    setSelected(item);
    setRecentIds(rememberVaultRecent(item.id));
  }

  function clearRecents() {
    clearVaultRecents();
    setRecentIds([]);
    setToast("Recent list cleared");
  }

  async function copy(value: string, label = "Copied") {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    clipboardValueRef.current = value;
    window.setTimeout(async () => {
      if (clipboardValueRef.current !== value) return;
      try {
        const current = await navigator.clipboard.readText();
        if (current === value) await navigator.clipboard.writeText("");
      } catch {
        // Clipboard read permission is browser-controlled; fail closed without
        // replacing content the user may have copied elsewhere.
      }
      if (clipboardValueRef.current === value) clipboardValueRef.current = "";
    }, 30_000);
    setToast(label);
  }

  async function saveItem(item: VaultItem) {
    if (!repository) return;
    const saved = { ...item, updatedAt: new Date().toISOString() };
    try {
      await repository.save(saved);
    } catch {
      setDataError("The encrypted item could not be saved. No local UI changes were applied.");
      return;
    }
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
    if (!repository) return;
    try {
      await repository.remove(id);
    } catch {
      setDataError("The item could not be moved to Recently deleted.");
      return;
    }
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
    if (!repository) throw new Error("Vault is locked.");
    const tag: VaultTag = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: tagPalette[tags.length % tagPalette.length],
    };
    try {
      await repository.saveTag(tag);
    } catch {
      setDataError("The encrypted tag could not be saved.");
      throw new Error("The encrypted tag could not be saved.");
    }
    setTags((current) => [...current, tag]);
    return tag;
  }

  async function removeTag(id: string): Promise<boolean> {
    if (!repository) return false;
    try {
      await repository.removeTag(id);
    } catch {
      setDataError("The tag could not be deleted.");
      return false;
    }
    const orphaned = items.filter((item) => item.tags.includes(id));
    const cleaned = orphaned.map((item) => ({
      ...item,
      tags: item.tags.filter((tag) => tag !== id),
    }));
    try {
      await Promise.all(cleaned.map((item) => repository.save(item)));
    } catch {
      setDataError("The tag was deleted, but some item links could not be updated.");
      await loadVaultData();
      return false;
    }
    setItems((current) =>
      current.map((item) => cleaned.find((candidate) => candidate.id === item.id) ?? item)
    );
    setTags((current) => current.filter((tag) => tag.id !== id));
    if (tagFilter === id) setTagFilter(null);
    setToast("Tag deleted");
    return true;
  }

  async function importData(importedItems: VaultItem[], newTags: VaultTag[]) {
    if (!repository) return;
    try {
      for (const tag of newTags) await repository.saveTag(tag);
      await saveVaultItems(repository, importedItems, "import");
    } catch {
      setDataError("Import stopped because encrypted sync failed. Review before retrying.");
      await loadVaultData();
      return;
    }
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
    if (!repository) return;
    let restored: VaultItem | undefined;
    try {
      restored = await repository.restore(item.id);
    } catch {
      setDataError("The item could not be restored.");
      return;
    }
    if (!restored) return;
    setDeletedItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setItems((current) => [restored, ...current]);
    setToast("Item restored");
  }

  async function purgeItem(item: VaultItem) {
    if (!repository) return;
    try {
      await repository.purge(item.id);
    } catch {
      setDataError("The item could not be permanently deleted.");
      return;
    }
    setDeletedItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setToast("Item permanently deleted");
  }

  if (vault.status === "loading") {
    return (
      <VaultUnlockScreen
        mode="unlock"
        loading
        onSetup={vault.setup}
        onUnlock={vault.unlock}
      />
    );
  }

  if (vault.status === "setup") {
    return (
      <VaultUnlockScreen
        mode="setup"
        loading={vault.busy}
        error={vault.error}
        localItemCount={vault.localCounts.items}
        onSetup={vault.setup}
        onUnlock={vault.unlock}
      />
    );
  }

  if (vault.status === "locked") {
    return (
      <VaultUnlockScreen
        mode="unlock"
        loading={vault.busy}
        error={vault.error}
        localItemCount={vault.localCounts.items}
        onSetup={vault.setup}
        onUnlock={vault.unlock}
      />
    );
  }

  if (vault.status === "unavailable" || !repository) {
    return (
      <VaultUnlockScreen
        mode="unavailable"
        error={vault.error}
        localItemCount={vault.localCounts.items}
        onSetup={vault.setup}
        onUnlock={vault.unlock}
        onRetry={vault.retry}
      />
    );
  }

  if (vault.migrationPending) {
    return (
      <VaultMigrationPrompt
        counts={vault.localCounts}
        busy={vault.busy}
        error={vault.error}
        onMigrate={() => {
          void vault.migrate().then(loadVaultData);
        }}
        onSkip={vault.lock}
        onDiscard={() => void vault.discardPlaintext()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[720px] pb-28">
      {dataError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3.5 py-3 text-[13px] text-otto-red"
        >
          {dataError}
        </div>
      )}
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
          recentIds={recentIds}
          onClearRecents={clearRecents}
          onSelect={openItem}
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
          recentCount={recentIds.length}
          onClearRecents={() => {
            if (!recentIds.length) return;
            if (window.confirm("Clear the list of recently opened entries on this device?")) {
              clearRecents();
            }
          }}
          onSecurity={() => setSecuritySettings(true)}
          autoLockMinutes={vault.autoLockMinutes}
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
          repository={repository}
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
          onRemove={removeTag}
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
      {securitySettings && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-otto-bg">
          <button
            type="button"
            onClick={() => setSecuritySettings(false)}
            className="sticky left-3 top-3 z-10 rounded-full bg-otto-surface px-3 py-2 text-[13px] font-semibold"
          >
            Close
          </button>
          <VaultSecuritySettings
            autoLockMinutes={vault.autoLockMinutes}
            onAutoLockChange={(minutes) => void vault.updateAutoLock(minutes)}
            onLock={vault.lock}
            onChangePassword={(current, next) => {
              void vault.changePassword(current, next).then((changed) => {
                if (changed) setToast("Master password updated");
              });
            }}
            busy={vault.busy}
            error={vault.error}
          />
        </div>
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
