export const VAULT_TRASH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function trashRemaining(deletedAt: string | undefined, now = new Date()): number | null {
  if (!deletedAt) return null;
  const deleted = new Date(deletedAt).getTime();
  if (Number.isNaN(deleted)) return null;
  return deleted + VAULT_TRASH_DAYS * DAY_MS - now.getTime();
}

export function canRestoreVaultItem(deletedAt: string | undefined, now = new Date()): boolean {
  const remaining = trashRemaining(deletedAt, now);
  return remaining != null && remaining > 0;
}

export function trashTimeLeft(deletedAt: string | undefined, now = new Date()): string {
  const remaining = trashRemaining(deletedAt, now);
  if (remaining == null || remaining <= 0) return "Expired";
  if (remaining < DAY_MS) return "Less than a day left";
  const days = Math.ceil(remaining / DAY_MS);
  return `${days} ${days === 1 ? "day" : "days"} left`;
}
