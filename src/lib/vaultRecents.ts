import type { VaultItem } from "@/lib/vaultRepository";

/** Recently opened vault entries, stored per device and never synced. */
export const VAULT_RECENTS_KEY = "trader-otto:vault-recents";
export const MAX_VAULT_RECENTS = 20;

export function readVaultRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VAULT_RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_VAULT_RECENTS);
  } catch {
    return [];
  }
}

export function rememberVaultRecent(id: string): string[] {
  const next = nextRecents(readVaultRecents(), id);
  try {
    window.localStorage.setItem(VAULT_RECENTS_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store only costs the convenience list, never vault data.
  }
  return next;
}

export function clearVaultRecents() {
  try {
    window.localStorage.removeItem(VAULT_RECENTS_KEY);
  } catch {
    // Ignore storage failures; callers still clear their in-memory copy.
  }
}

export function nextRecents(current: string[], id: string): string[] {
  return [id, ...current.filter((entry) => entry !== id)].slice(0, MAX_VAULT_RECENTS);
}

export function orderByRecent(items: VaultItem[], recentIds: string[]): VaultItem[] {
  const rank = new Map(recentIds.map((id, index) => [id, index]));
  return items
    .filter((item) => rank.has(item.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}
