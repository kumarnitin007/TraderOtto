export type VaultKind =
  | "login"
  | "note"
  | "contact"
  | "card"
  | "bank"
  | "license"
  | "passport"
  | "ssn"
  | "health"
  | "insurance"
  | "membership"
  | "wifi"
  | "email"
  | "messenger"
  | "database"
  | "server"
  | "ssh"
  | "software";

export interface VaultItem {
  id: string;
  kind: VaultKind;
  name: string;
  username?: string;
  password?: string;
  website?: string;
  note?: string;
  tags: string[];
  favorite: boolean;
  color: string;
  createdAt?: string;
  updatedAt: string;
  customFields?: Record<string, string>;
  deletedAt?: string;
}

export interface VaultTag {
  id: string;
  name: string;
  color: string;
}

export type VaultChangeSource = "manual" | "import" | "system";

export interface VaultHistoryEntry {
  id: string;
  itemId: string;
  changedAt: string;
  source: VaultChangeSource;
  action: "created" | "updated" | "deleted" | "restored";
  fields: string[];
}

export interface VaultRepository {
  list(): Promise<VaultItem[]>;
  listDeleted(): Promise<VaultItem[]>;
  save(item: VaultItem, source?: VaultChangeSource): Promise<VaultItem>;
  remove(id: string): Promise<void>;
  restore(id: string): Promise<VaultItem | undefined>;
  purge(id: string): Promise<void>;
  listHistory(itemId: string): Promise<VaultHistoryEntry[]>;
  listTags(): Promise<VaultTag[]>;
  saveTag(tag: VaultTag): Promise<VaultTag>;
  removeTag(id: string): Promise<void>;
}

const DB_NAME = "traderotto-vault-local-prototype";
const DB_VERSION = 2;
const ITEM_STORE = "vault-items";
const TAG_STORE = "vault-tags";
const HISTORY_STORE = "vault-history";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ITEM_STORE)) {
        db.createObjectStore(ITEM_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(TAG_STORE)) {
        db.createObjectStore(TAG_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        historyStore.createIndex("itemId", "itemId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(
          db.transaction(storeName, mode).objectStore(storeName)
        );
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

/** Browser-only local store for vault UI prototyping. Not encrypted; swap for Supabase later. */
export class IndexedDbVaultRepository implements VaultRepository {
  async list(): Promise<VaultItem[]> {
    const items = await run<VaultItem[]>(ITEM_STORE, "readonly", (store) =>
      store.getAll()
    );
    return items
      .filter((item) => !item.deletedAt)
      .map((item) => ({ ...item, tags: item.tags ?? [] }));
  }

  async listDeleted(): Promise<VaultItem[]> {
    const items = await run<VaultItem[]>(ITEM_STORE, "readonly", (store) =>
      store.getAll()
    );
    return items
      .filter((item) => Boolean(item.deletedAt))
      .map((item) => ({ ...item, tags: item.tags ?? [] }))
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  }

  async save(
    item: VaultItem,
    source: VaultChangeSource = "manual"
  ): Promise<VaultItem> {
    const previous = await run<VaultItem | undefined>(
      ITEM_STORE,
      "readonly",
      (store) => store.get(item.id)
    );
    await run(ITEM_STORE, "readwrite", (store) => store.put(item));
    const fields = changedFields(previous, item);
    if (!previous || fields.length) {
      await this.addHistory({
        itemId: item.id,
        source,
        action: previous ? "updated" : "created",
        fields,
      });
    }
    return item;
  }

  async remove(id: string): Promise<void> {
    const item = await run<VaultItem | undefined>(ITEM_STORE, "readonly", (store) =>
      store.get(id)
    );
    if (!item || item.deletedAt) return;
    const deletedAt = new Date().toISOString();
    await run(ITEM_STORE, "readwrite", (store) =>
      store.put({ ...item, deletedAt, updatedAt: deletedAt })
    );
    await this.addHistory({
      itemId: id,
      source: "manual",
      action: "deleted",
      fields: ["deletedAt"],
    });
  }

  async restore(id: string): Promise<VaultItem | undefined> {
    const item = await run<VaultItem | undefined>(ITEM_STORE, "readonly", (store) =>
      store.get(id)
    );
    if (!item) return undefined;
    const restored = {
      ...item,
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    await run(ITEM_STORE, "readwrite", (store) => store.put(restored));
    await this.addHistory({
      itemId: id,
      source: "manual",
      action: "restored",
      fields: ["deletedAt"],
    });
    return restored;
  }

  async purge(id: string): Promise<void> {
    await run(ITEM_STORE, "readwrite", (store) => store.delete(id));
    const history = await this.listHistory(id);
    await Promise.all(
      history.map((entry) =>
        run(HISTORY_STORE, "readwrite", (store) => store.delete(entry.id))
      )
    );
  }

  async listHistory(itemId: string): Promise<VaultHistoryEntry[]> {
    const entries = await run<VaultHistoryEntry[]>(
      HISTORY_STORE,
      "readonly",
      (store) => store.index("itemId").getAll(itemId)
    );
    return entries.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  }

  async listTags(): Promise<VaultTag[]> {
    return run<VaultTag[]>(TAG_STORE, "readonly", (store) => store.getAll());
  }

  async saveTag(tag: VaultTag): Promise<VaultTag> {
    await run(TAG_STORE, "readwrite", (store) => store.put(tag));
    return tag;
  }

  async removeTag(id: string): Promise<void> {
    await run(TAG_STORE, "readwrite", (store) => store.delete(id));
  }

  private async addHistory(
    entry: Omit<VaultHistoryEntry, "id" | "changedAt">
  ): Promise<void> {
    const history: VaultHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      changedAt: new Date().toISOString(),
    };
    await run(HISTORY_STORE, "readwrite", (store) => store.put(history));
  }
}

export const vaultRepository: VaultRepository = new IndexedDbVaultRepository();

function changedFields(
  previous: VaultItem | undefined,
  next: VaultItem
): string[] {
  if (!previous) {
    return Object.keys(next).filter((field) => field !== "id");
  }
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  keys.delete("id");
  keys.delete("updatedAt");
  return [...keys].filter(
    (key) =>
      JSON.stringify(previous[key as keyof VaultItem] ?? null) !==
      JSON.stringify(next[key as keyof VaultItem] ?? null)
  );
}
