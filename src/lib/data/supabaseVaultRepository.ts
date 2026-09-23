import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ITEM_PAYLOAD_SCHEMA_VERSION,
  blindIndex,
  decryptJson,
  encryptJson,
  historySnapshotAad,
  itemPayloadAad,
  tagNameAad,
} from "@/lib/vault/crypto";
import { byteaFromDb, byteaToDb } from "@/lib/vault/encoding";
import type {
  VaultChangeSource,
  VaultHistoryEntry,
  VaultItem,
  VaultKind,
  VaultRepository,
  VaultTag,
} from "@/lib/vaultRepository";

/** Unlocked vault material held only in memory for the active session. */
export type SupabaseVaultSession = {
  vaultKey: Uint8Array;
  keyVersion: number;
};

const BLIND_ITEM_DEDUPE = "ov:item:dedupe:v1";
const BLIND_ITEM_NAME_SORT = "ov:item:name-sort:v1";
const BLIND_TAG_NAME = "ov:tag:name:v1";

type ItemPayload = {
  name: string;
  username?: string;
  password?: string;
  website?: string;
  note?: string;
  customFields?: Record<string, string>;
};

type ItemRow = {
  id: string;
  user_id: string;
  kind: string;
  favorite: boolean;
  color: string | null;
  payload_ciphertext: string;
  payload_nonce: string;
  payload_schema_version: number;
  key_version: number;
  dedupe_blind_index: string | null;
  name_sort_blind_index: string | null;
  source_created_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type TagRow = {
  id: string;
  user_id: string;
  name_ciphertext: string;
  name_nonce: string;
  name_blind_index: string | null;
  color: string | null;
  key_version: number;
  created_at: string;
  updated_at: string;
};

type ItemTagRow = {
  item_id: string;
  tag_id: string;
};

type HistoryRow = {
  id: string;
  item_id: string;
  action: VaultHistoryEntry["action"];
  source: VaultChangeSource;
  changed_fields: string[] | null;
  snapshot_ciphertext: string | null;
  snapshot_nonce: string | null;
  key_version: number;
  created_at: string;
};

type HistorySnapshot = ItemPayload & {
  kind: VaultKind;
  favorite: boolean;
  color: string;
  tags: string[];
  deletedAt?: string;
  createdAt?: string;
};

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const DB_BATCH_SIZE = 100;
const CRYPTO_BATCH_SIZE = 12;

function dedupeItemsById(items: VaultItem[]): VaultItem[] {
  const byId = new Map<string, VaultItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

async function mapInCryptoBatches<T, R>(
  values: T[],
  fn: (value: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < values.length; i += CRYPTO_BATCH_SIZE) {
    const batch = values.slice(i, i + CRYPTO_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function payloadFromItem(item: VaultItem): ItemPayload {
  return {
    name: item.name,
    username: item.username,
    password: item.password,
    website: item.website,
    note: item.note,
    customFields: item.customFields,
  };
}

function snapshotFromItem(item: VaultItem): HistorySnapshot {
  return {
    ...payloadFromItem(item),
    kind: item.kind,
    favorite: item.favorite,
    color: item.color,
    tags: item.tags ?? [],
    deletedAt: item.deletedAt,
    createdAt: item.createdAt,
  };
}

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

function itemDedupeMaterial(name: string, username?: string): string {
  return `${normalizeText(name)}\x1e${normalizeText(username ?? "")}`;
}

async function encryptPayload(
  vaultKey: Uint8Array,
  userId: string,
  itemId: string,
  payload: ItemPayload,
  schemaVersion: number
) {
  const aad = itemPayloadAad(userId, itemId, schemaVersion);
  return encryptJson(vaultKey, payload, aad);
}

async function decryptPayload(
  vaultKey: Uint8Array,
  expectedKeyVersion: number,
  userId: string,
  row: Pick<
    ItemRow,
    | "id"
    | "payload_ciphertext"
    | "payload_nonce"
    | "payload_schema_version"
    | "key_version"
  >
): Promise<ItemPayload> {
  if (row.key_version !== expectedKeyVersion) {
    throw new Error("Vault item uses an unsupported key version.");
  }
  const aad = itemPayloadAad(
    userId,
    row.id,
    row.payload_schema_version
  );
  return decryptJson<ItemPayload>(
    vaultKey,
    byteaFromDb(row.payload_ciphertext),
    byteaFromDb(row.payload_nonce),
    aad
  );
}

function rowToItem(
  row: ItemRow,
  tagIds: string[],
  payload: ItemPayload
): VaultItem {
  return {
    id: row.id,
    kind: row.kind as VaultKind,
    name: payload.name,
    username: payload.username,
    password: payload.password,
    website: payload.website,
    note: payload.note,
    customFields: payload.customFields,
    tags: tagIds,
    favorite: row.favorite,
    color: row.color ?? "",
    createdAt: row.source_created_at ?? row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function mapHistoryRow(row: HistoryRow): VaultHistoryEntry {
  return {
    id: row.id,
    itemId: row.item_id,
    changedAt: row.created_at,
    source: row.source,
    action: row.action,
    fields: row.changed_fields ?? [],
  };
}

export function createSupabaseVaultRepository(
  supabase: SupabaseClient,
  userId: string,
  session: SupabaseVaultSession
): VaultRepository {
  const { vaultKey, keyVersion } = session;

  async function loadItemTagMap(): Promise<Map<string, string[]>> {
    const { data, error } = await supabase
      .from("ov_item_tags")
      .select("item_id, tag_id")
      .eq("user_id", userId);
    throwOnError(error);
    const map = new Map<string, string[]>();
    for (const row of (data ?? []) as ItemTagRow[]) {
      const list = map.get(row.item_id) ?? [];
      list.push(row.tag_id);
      map.set(row.item_id, list);
    }
    return map;
  }

  async function fetchItemById(id: string): Promise<VaultItem | undefined> {
    const { data, error } = await supabase
      .from("ov_items")
      .select(
        "id, user_id, kind, favorite, color, payload_ciphertext, payload_nonce, payload_schema_version, key_version, dedupe_blind_index, name_sort_blind_index, source_created_at, deleted_at, created_at, updated_at"
      )
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    throwOnError(error);
    if (!data) return undefined;
    const row = data as ItemRow;
    const { data: tagRows, error: tagError } = await supabase
      .from("ov_item_tags")
      .select("tag_id")
      .eq("user_id", userId)
      .eq("item_id", id);
    throwOnError(tagError);
    const tagIds = ((tagRows ?? []) as { tag_id: string }[]).map(
      (t) => t.tag_id
    );
    const payload = await decryptPayload(vaultKey, keyVersion, userId, row);
    return rowToItem(row, tagIds, payload);
  }

  async function rowsToItems(rows: ItemRow[]): Promise<VaultItem[]> {
    const tagMap = await loadItemTagMap();
    return mapInCryptoBatches(rows, async (row) => {
      const payload = await decryptPayload(vaultKey, keyVersion, userId, row);
      return rowToItem(row, tagMap.get(row.id) ?? [], payload);
    });
  }

  async function syncItemTags(itemId: string, tagIds: string[]): Promise<void> {
    const { data, error } = await supabase
      .from("ov_item_tags")
      .select("tag_id")
      .eq("user_id", userId)
      .eq("item_id", itemId);
    throwOnError(error);
    const existing = new Set(
      ((data ?? []) as { tag_id: string }[]).map((r) => r.tag_id)
    );
    const desired = new Set(tagIds);
    const toRemove = [...existing].filter((id) => !desired.has(id));
    const toAdd = [...desired].filter((id) => !existing.has(id));

    if (toRemove.length) {
      const { error: deleteError } = await supabase
        .from("ov_item_tags")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .in("tag_id", toRemove);
      throwOnError(deleteError);
    }

    if (toAdd.length) {
      const { error: insertError } = await supabase.from("ov_item_tags").insert(
        toAdd.map((tagId) => ({
          user_id: userId,
          item_id: itemId,
          tag_id: tagId,
        }))
      );
      throwOnError(insertError);
    }
  }

  const itemSelectColumns =
    "id, user_id, kind, favorite, color, payload_ciphertext, payload_nonce, payload_schema_version, key_version, dedupe_blind_index, name_sort_blind_index, source_created_at, deleted_at, created_at, updated_at";

  async function fetchItemsByIds(ids: string[]): Promise<Map<string, VaultItem>> {
    const map = new Map<string, VaultItem>();
    if (!ids.length) return map;

    for (let i = 0; i < ids.length; i += DB_BATCH_SIZE) {
      const idChunk = ids.slice(i, i + DB_BATCH_SIZE);
      const { data, error } = await supabase
        .from("ov_items")
        .select(itemSelectColumns)
        .eq("user_id", userId)
        .in("id", idChunk);
      throwOnError(error);
      const rows = (data ?? []) as ItemRow[];
      if (!rows.length) continue;

      const { data: tagData, error: tagError } = await supabase
        .from("ov_item_tags")
        .select("item_id, tag_id")
        .eq("user_id", userId)
        .in("item_id", idChunk);
      throwOnError(tagError);
      const tagMap = new Map<string, string[]>();
      for (const row of (tagData ?? []) as ItemTagRow[]) {
        const list = tagMap.get(row.item_id) ?? [];
        list.push(row.tag_id);
        tagMap.set(row.item_id, list);
      }

      const decrypted = await mapInCryptoBatches(rows, async (row) => {
        const payload = await decryptPayload(vaultKey, keyVersion, userId, row);
        return rowToItem(row, tagMap.get(row.id) ?? [], payload);
      });
      for (const item of decrypted) {
        map.set(item.id, item);
      }
    }
    return map;
  }

  async function buildUpsertRow(
    item: VaultItem,
    previous: VaultItem | undefined
  ) {
    const payload = payloadFromItem(item);
    const schemaVersion = ITEM_PAYLOAD_SCHEMA_VERSION;
    const { ciphertext, nonce } = await encryptPayload(
      vaultKey,
      userId,
      item.id,
      payload,
      schemaVersion
    );
    const normName = normalizeText(item.name);
    const dedupeIndex = await blindIndex(
      vaultKey,
      BLIND_ITEM_DEDUPE,
      itemDedupeMaterial(item.name, item.username)
    );
    const nameSortIndex = await blindIndex(
      vaultKey,
      BLIND_ITEM_NAME_SORT,
      normName
    );
    return {
      id: item.id,
      user_id: userId,
      kind: item.kind,
      favorite: item.favorite,
      color: item.color || null,
      payload_ciphertext: byteaToDb(ciphertext),
      payload_nonce: byteaToDb(nonce),
      payload_schema_version: schemaVersion,
      key_version: keyVersion,
      dedupe_blind_index: byteaToDb(dedupeIndex),
      name_sort_blind_index: byteaToDb(nameSortIndex),
      source_created_at: item.createdAt ?? previous?.createdAt ?? null,
      deleted_at: item.deletedAt ?? null,
      updated_at: item.updatedAt,
    };
  }

  async function replaceItemTagsForItems(items: VaultItem[]): Promise<void> {
    if (!items.length) return;
    const itemIds = items.map((item) => item.id);

    for (let i = 0; i < itemIds.length; i += DB_BATCH_SIZE) {
      const idChunk = itemIds.slice(i, i + DB_BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from("ov_item_tags")
        .delete()
        .eq("user_id", userId)
        .in("item_id", idChunk);
      throwOnError(deleteError);
    }

    const associationRows: { user_id: string; item_id: string; tag_id: string }[] =
      [];
    for (const item of items) {
      for (const tagId of item.tags ?? []) {
        associationRows.push({
          user_id: userId,
          item_id: item.id,
          tag_id: tagId,
        });
      }
    }

    for (let i = 0; i < associationRows.length; i += DB_BATCH_SIZE) {
      const chunk = associationRows.slice(i, i + DB_BATCH_SIZE);
      if (!chunk.length) continue;
      const { error: insertError } = await supabase
        .from("ov_item_tags")
        .insert(chunk);
      throwOnError(insertError);
    }
  }

  async function insertHistoryBatch(
    entries: {
      entry: Omit<VaultHistoryEntry, "id" | "changedAt">;
      previous: VaultItem | undefined;
    }[]
  ): Promise<void> {
    if (!entries.length) return;

    const rows = await mapInCryptoBatches(entries, async ({ entry, previous }) => {
      const historyId = crypto.randomUUID();
      let snapshot_ciphertext: string | null = null;
      let snapshot_nonce: string | null = null;

      if (previous) {
        const snapshot = snapshotFromItem(previous);
        const aad = historySnapshotAad(
          userId,
          entry.itemId,
          historyId,
          ITEM_PAYLOAD_SCHEMA_VERSION
        );
        const encrypted = await encryptJson(vaultKey, snapshot, aad);
        snapshot_ciphertext = byteaToDb(encrypted.ciphertext);
        snapshot_nonce = byteaToDb(encrypted.nonce);
      }

      return {
        id: historyId,
        user_id: userId,
        item_id: entry.itemId,
        action: entry.action,
        source: entry.source,
        changed_fields: entry.fields,
        snapshot_ciphertext,
        snapshot_nonce,
        key_version: keyVersion,
      };
    });

    for (let i = 0; i < rows.length; i += DB_BATCH_SIZE) {
      const chunk = rows.slice(i, i + DB_BATCH_SIZE);
      const { error } = await supabase.from("ov_item_history").insert(chunk);
      throwOnError(error);
    }
  }

  async function insertHistory(
    entry: Omit<VaultHistoryEntry, "id" | "changedAt">,
    previous: VaultItem | undefined
  ): Promise<void> {
    const historyId = crypto.randomUUID();
    let snapshot_ciphertext: string | null = null;
    let snapshot_nonce: string | null = null;

    if (previous) {
      const snapshot = snapshotFromItem(previous);
      const aad = historySnapshotAad(
        userId,
        entry.itemId,
        historyId,
        ITEM_PAYLOAD_SCHEMA_VERSION
      );
      const encrypted = await encryptJson(vaultKey, snapshot, aad);
      snapshot_ciphertext = byteaToDb(encrypted.ciphertext);
      snapshot_nonce = byteaToDb(encrypted.nonce);
    }

    const { error } = await supabase.from("ov_item_history").insert({
      id: historyId,
      user_id: userId,
      item_id: entry.itemId,
      action: entry.action,
      source: entry.source,
      changed_fields: entry.fields,
      snapshot_ciphertext,
      snapshot_nonce,
      key_version: keyVersion,
    });
    throwOnError(error);
  }

  return {
    async list(): Promise<VaultItem[]> {
      const { data, error } = await supabase
        .from("ov_items")
        .select(
          "id, user_id, kind, favorite, color, payload_ciphertext, payload_nonce, payload_schema_version, key_version, dedupe_blind_index, name_sort_blind_index, source_created_at, deleted_at, created_at, updated_at"
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      throwOnError(error);
      return rowsToItems((data ?? []) as ItemRow[]);
    },

    async listDeleted(): Promise<VaultItem[]> {
      const { data, error } = await supabase
        .from("ov_items")
        .select(
          "id, user_id, kind, favorite, color, payload_ciphertext, payload_nonce, payload_schema_version, key_version, dedupe_blind_index, name_sort_blind_index, source_created_at, deleted_at, created_at, updated_at"
        )
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      throwOnError(error);
      return rowsToItems((data ?? []) as ItemRow[]);
    },

    async save(
      item: VaultItem,
      source: VaultChangeSource = "manual"
    ): Promise<VaultItem> {
      const previous = await fetchItemById(item.id);
      const payload = payloadFromItem(item);
      const schemaVersion = ITEM_PAYLOAD_SCHEMA_VERSION;
      const { ciphertext, nonce } = await encryptPayload(
        vaultKey,
        userId,
        item.id,
        payload,
        schemaVersion
      );

      const normName = normalizeText(item.name);
      const dedupeIndex = await blindIndex(
        vaultKey,
        BLIND_ITEM_DEDUPE,
        itemDedupeMaterial(item.name, item.username)
      );
      const nameSortIndex = await blindIndex(
        vaultKey,
        BLIND_ITEM_NAME_SORT,
        normName
      );

      const { error } = await supabase.from("ov_items").upsert(
        {
          id: item.id,
          user_id: userId,
          kind: item.kind,
          favorite: item.favorite,
          color: item.color || null,
          payload_ciphertext: byteaToDb(ciphertext),
          payload_nonce: byteaToDb(nonce),
          payload_schema_version: schemaVersion,
          key_version: keyVersion,
          dedupe_blind_index: byteaToDb(dedupeIndex),
          name_sort_blind_index: byteaToDb(nameSortIndex),
          source_created_at: item.createdAt ?? previous?.createdAt ?? null,
          deleted_at: item.deletedAt ?? null,
          updated_at: item.updatedAt,
        },
        { onConflict: "id" }
      );
      throwOnError(error);

      await syncItemTags(item.id, item.tags ?? []);

      const fields = changedFields(previous, item);
      if (!previous || fields.length) {
        await insertHistory(
          {
            itemId: item.id,
            source,
            action: previous ? "updated" : "created",
            fields,
          },
          previous
        );
      }

      return item;
    },

    async saveMany(
      items: VaultItem[],
      source: VaultChangeSource = "manual"
    ): Promise<VaultItem[]> {
      const uniqueItems = dedupeItemsById(items);
      if (!uniqueItems.length) return [];

      const previousById = await fetchItemsByIds(uniqueItems.map((item) => item.id));

      type PreparedItem = {
        item: VaultItem;
        previous: VaultItem | undefined;
        fields: string[];
        action: "created" | "updated";
        upsertRow: Awaited<ReturnType<typeof buildUpsertRow>>;
      };

      const prepared = await mapInCryptoBatches(uniqueItems, async (item) => {
        const previous = previousById.get(item.id);
        const fields = changedFields(previous, item);
        const upsertRow = await buildUpsertRow(item, previous);
        return {
          item,
          previous,
          fields,
          action: (previous ? "updated" : "created") as "created" | "updated",
          upsertRow,
        } satisfies PreparedItem;
      });

      for (let i = 0; i < prepared.length; i += DB_BATCH_SIZE) {
        const chunk = prepared.slice(i, i + DB_BATCH_SIZE);
        const { error } = await supabase
          .from("ov_items")
          .upsert(
            chunk.map((row) => row.upsertRow),
            { onConflict: "id" }
          );
        throwOnError(error);

        await replaceItemTagsForItems(chunk.map((row) => row.item));

        const historyEntries = chunk
          .filter((row) => !row.previous || row.fields.length > 0)
          .map((row) => ({
            entry: {
              itemId: row.item.id,
              source,
              action: row.action,
              fields: row.fields,
            },
            previous: row.previous,
          }));
        await insertHistoryBatch(historyEntries);
      }

      return uniqueItems;
    },

    async remove(id: string): Promise<void> {
      const item = await fetchItemById(id);
      if (!item || item.deletedAt) return;
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("ov_items")
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq("user_id", userId)
        .eq("id", id);
      throwOnError(error);
      await insertHistory(
        {
          itemId: id,
          source: "manual",
          action: "deleted",
          fields: ["deletedAt"],
        },
        item
      );
    },

    async restore(id: string): Promise<VaultItem | undefined> {
      const item = await fetchItemById(id);
      if (!item) return undefined;
      const updatedAt = new Date().toISOString();
      const restored: VaultItem = {
        ...item,
        deletedAt: undefined,
        updatedAt,
      };
      const { error } = await supabase
        .from("ov_items")
        .update({ deleted_at: null, updated_at: updatedAt })
        .eq("user_id", userId)
        .eq("id", id);
      throwOnError(error);
      await insertHistory(
        {
          itemId: id,
          source: "manual",
          action: "restored",
          fields: ["deletedAt"],
        },
        item
      );
      return restored;
    },

    async purge(id: string): Promise<void> {
      const { error: historyError } = await supabase
        .from("ov_item_history")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", id);
      throwOnError(historyError);

      const { error } = await supabase
        .from("ov_items")
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      throwOnError(error);
    },

    async listHistory(itemId: string): Promise<VaultHistoryEntry[]> {
      const { data, error } = await supabase
        .from("ov_item_history")
        .select(
          "id, item_id, action, source, changed_fields, snapshot_ciphertext, snapshot_nonce, key_version, created_at"
        )
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .order("created_at", { ascending: false });
      throwOnError(error);
      return ((data ?? []) as HistoryRow[]).map(mapHistoryRow);
    },

    async listTags(): Promise<VaultTag[]> {
      const { data, error } = await supabase
        .from("ov_tags")
        .select(
          "id, user_id, name_ciphertext, name_nonce, name_blind_index, color, key_version, created_at, updated_at"
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      throwOnError(error);

      return mapInCryptoBatches(
        (data ?? []) as TagRow[],
        async (row) => {
          if (row.key_version !== keyVersion) {
            throw new Error("Vault tag uses an unsupported key version.");
          }
          const aad = tagNameAad(userId, row.id);
          const { name } = await decryptJson<{ name: string }>(
            vaultKey,
            byteaFromDb(row.name_ciphertext),
            byteaFromDb(row.name_nonce),
            aad
          );
          return {
            id: row.id,
            name,
            color: row.color ?? "",
          };
        }
      );
    },

    async saveTag(tag: VaultTag): Promise<VaultTag> {
      const normName = normalizeText(tag.name);
      const nameIndex = await blindIndex(vaultKey, BLIND_TAG_NAME, normName);
      const aad = tagNameAad(userId, tag.id);
      const { ciphertext, nonce } = await encryptJson(
        vaultKey,
        { name: tag.name },
        aad
      );

      const { error } = await supabase.from("ov_tags").upsert(
        {
          id: tag.id,
          user_id: userId,
          name_ciphertext: byteaToDb(ciphertext),
          name_nonce: byteaToDb(nonce),
          name_blind_index: byteaToDb(nameIndex),
          color: tag.color || null,
          key_version: keyVersion,
        },
        { onConflict: "id" }
      );
      throwOnError(error);
      return tag;
    },

    async removeTag(id: string): Promise<void> {
      const { error } = await supabase
        .from("ov_tags")
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      throwOnError(error);
    },
  };
}
