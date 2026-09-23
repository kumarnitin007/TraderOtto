import type { VaultItem, VaultTag } from "@/lib/vaultRepository";

export type VaultTagSort = "name-asc" | "name-desc" | "count-desc" | "count-asc";

export const VAULT_TAG_SORT_OPTIONS: { value: VaultTagSort; label: string }[] = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "count-desc", label: "Most used" },
  { value: "count-asc", label: "Least used" },
];

export function tagUsageCount(items: VaultItem[], tagId: string): number {
  return items.reduce((count, item) => count + (item.tags.includes(tagId) ? 1 : 0), 0);
}

export function sortVaultTags(
  tags: VaultTag[],
  items: VaultItem[],
  sort: VaultTagSort
): VaultTag[] {
  const counts = new Map(tags.map((tag) => [tag.id, tagUsageCount(items, tag.id)]));
  const next = [...tags];
  next.sort((a, b) => {
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    if (sort === "count-desc" || sort === "count-asc") {
      const delta = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      const byCount = sort === "count-desc" ? delta : -delta;
      return byCount || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  return next;
}
