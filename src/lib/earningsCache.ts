import type { WatchTracker } from "@/types/watchGroup";
import { todayISO } from "@/lib/pnl";

const EMPTY_REFRESH_DAYS = 7;

function daysBetween(from: string, to: string) {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  return Math.round((end - start) / 86_400_000);
}

/** Fetch only if missing, past, or an empty lookup is older than a week. */
export function earningsCacheNeedsRefresh(
  cache: { earningsDate: string | null; earningsCheckedAt: string | null },
  today = todayISO()
) {
  if (cache.earningsDate && cache.earningsDate >= today) return false;
  if (cache.earningsDate && cache.earningsDate < today) return true;
  if (!cache.earningsCheckedAt) return true;
  return daysBetween(cache.earningsCheckedAt.slice(0, 10), today) >= EMPTY_REFRESH_DAYS;
}

export function earningsNeedsRefresh(tracker: WatchTracker, today = todayISO()) {
  return earningsCacheNeedsRefresh(tracker, today);
}

/** An open spread crosses earnings when the announcement is still ahead and on or before expiry. */
export function crossesEarnings(
  expiry: string,
  earningsDate: string | null | undefined,
  today = todayISO()
) {
  return Boolean(earningsDate && earningsDate >= today && earningsDate <= expiry);
}

/** Industry rarely changes; fetch once, retry empty lookups after a week. */
export function sectorNeedsRefresh(tracker: WatchTracker, today = todayISO()) {
  if (tracker.sector) return false;
  if (!tracker.sectorCheckedAt) return true;
  return daysBetween(tracker.sectorCheckedAt.slice(0, 10), today) >= EMPTY_REFRESH_DAYS;
}
