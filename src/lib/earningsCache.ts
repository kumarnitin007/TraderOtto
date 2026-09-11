import type { WatchTracker } from "@/types/watchGroup";
import { todayISO } from "@/lib/pnl";

const EMPTY_REFRESH_DAYS = 7;

function daysBetween(from: string, to: string) {
  const start = new Date(from + "T00:00:00").getTime();
  const end = new Date(to + "T00:00:00").getTime();
  return Math.round((end - start) / 86_400_000);
}

/** Fetch only if missing, past, or an empty lookup is older than a week. */
export function earningsNeedsRefresh(tracker: WatchTracker, today = todayISO()) {
  if (tracker.earningsDate && tracker.earningsDate >= today) return false;
  if (tracker.earningsDate && tracker.earningsDate < today) return true;
  if (!tracker.earningsCheckedAt) return true;
  return daysBetween(tracker.earningsCheckedAt.slice(0, 10), today) >= EMPTY_REFRESH_DAYS;
}

/** Industry rarely changes; fetch once, retry empty lookups after a week. */
export function sectorNeedsRefresh(tracker: WatchTracker, today = todayISO()) {
  if (tracker.sector) return false;
  if (!tracker.sectorCheckedAt) return true;
  return daysBetween(tracker.sectorCheckedAt.slice(0, 10), today) >= EMPTY_REFRESH_DAYS;
}
