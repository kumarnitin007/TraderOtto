import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deletePlaintextVaultDatabase,
  plaintextVaultRepository,
  saveVaultItems,
  type VaultRepository,
} from "@/lib/vaultRepository";

export async function migratePlaintextVault({
  cloudRepository,
  supabase,
  userId,
  keyVersion,
}: {
  cloudRepository: VaultRepository;
  supabase: SupabaseClient;
  userId: string;
  keyVersion: number;
}): Promise<{ items: number; tags: number; history: number }> {
  const [active, deleted, tags] = await Promise.all([
    plaintextVaultRepository.list(),
    plaintextVaultRepository.listDeleted(),
    plaintextVaultRepository.listTags(),
  ]);
  const items = [...active, ...deleted];

  for (const tag of tags) {
    await cloudRepository.saveTag(tag);
  }
  await saveVaultItems(cloudRepository, items, "import");

  let historyCount = 0;
  for (const item of items) {
    const history = await plaintextVaultRepository.listHistory(item.id);
    if (!history.length) continue;
    const { error } = await supabase.from("ov_item_history").upsert(
      history.map((entry) => ({
        id: entry.id,
        user_id: userId,
        item_id: entry.itemId,
        action: entry.action,
        source: entry.source,
        changed_fields: entry.fields,
        snapshot_ciphertext: null,
        snapshot_nonce: null,
        key_version: keyVersion,
        created_at: entry.changedAt,
      })),
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (error) throw new Error(error.message);
    historyCount += history.length;
  }

  const [verifiedActive, verifiedDeleted, verifiedTags] = await Promise.all([
    cloudRepository.list(),
    cloudRepository.listDeleted(),
    cloudRepository.listTags(),
  ]);
  const cloudItemIds = new Set(
    [...verifiedActive, ...verifiedDeleted].map((item) => item.id)
  );
  const cloudTagIds = new Set(verifiedTags.map((tag) => tag.id));
  if (
    items.some((item) => !cloudItemIds.has(item.id)) ||
    tags.some((tag) => !cloudTagIds.has(tag.id))
  ) {
    throw new Error(
      "Encrypted upload could not be verified. Local plaintext was kept."
    );
  }
  const cloudItemsById = new Map(
    [...verifiedActive, ...verifiedDeleted].map((item) => [item.id, item])
  );
  const cloudTagsById = new Map(verifiedTags.map((tag) => [tag.id, tag]));
  if (
    items.some((item) => {
      const cloud = cloudItemsById.get(item.id);
      return !cloud || comparableItem(item) !== comparableItem(cloud);
    }) ||
    tags.some((tag) => {
      const cloud = cloudTagsById.get(tag.id);
      return !cloud || tag.name !== cloud.name || tag.color !== cloud.color;
    })
  ) {
    throw new Error(
      "Encrypted upload did not match the local source. Local plaintext was kept."
    );
  }

  await deletePlaintextVaultDatabase();
  return { items: items.length, tags: tags.length, history: historyCount };
}

function comparableItem(item: {
  id: string;
  kind: string;
  name: string;
  username?: string;
  password?: string;
  website?: string;
  note?: string;
  tags: string[];
  favorite: boolean;
  color: string;
  customFields?: Record<string, string>;
  deletedAt?: string;
}) {
  return JSON.stringify({
    id: item.id,
    kind: item.kind,
    name: item.name,
    username: item.username ?? null,
    password: item.password ?? null,
    website: item.website ?? null,
    note: item.note ?? null,
    tags: [...item.tags].sort(),
    favorite: item.favorite,
    color: item.color,
    customFields: Object.fromEntries(
      Object.entries(item.customFields ?? {}).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    ),
    deletedAt: item.deletedAt ?? null,
  });
}
