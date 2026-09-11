import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchGroup, WatchTracker } from "@/types/watchGroup";

type GroupRow = {
  id: string;
  name: string;
  tickers: unknown;
  meta: unknown;
  created_at: string;
  updated_at: string;
};

function trackers(value: unknown): WatchTracker[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.ticker !== "string") return [];
    return [
      {
        id: row.id,
        ticker: row.ticker.toUpperCase(),
        lowerTrigger:
          typeof row.lowerTrigger === "number" ? row.lowerTrigger : null,
        upperTrigger:
          typeof row.upperTrigger === "number" ? row.upperTrigger : null,
        notes: typeof row.notes === "string" ? row.notes : "",
        earningsDate: typeof row.earningsDate === "string" ? row.earningsDate : null,
        earningsTiming: typeof row.earningsTiming === "string" ? row.earningsTiming : null,
        earningsCheckedAt:
          typeof row.earningsCheckedAt === "string" ? row.earningsCheckedAt : null,
        sector: typeof row.sector === "string" ? row.sector : null,
        sectorCheckedAt:
          typeof row.sectorCheckedAt === "string" ? row.sectorCheckedAt : null,
      },
    ];
  });
}

function sortOrderOf(meta: unknown) {
  if (!meta || typeof meta !== "object") return Number.MAX_SAFE_INTEGER;
  const value = (meta as { sortOrder?: unknown }).sortOrder;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function metaOf(meta: unknown) {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function mapRow(row: GroupRow): WatchGroup {
  return {
    id: row.id,
    name: row.name,
    trackers: trackers(row.tickers),
    sortOrder: sortOrderOf(row.meta),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sortWatchGroups(groups: WatchGroup[]) {
  return [...groups].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)
  );
}

function requireGroup(data: unknown, error: { message: string } | null) {
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Supabase returned no group.");
  return mapRow(data as GroupRow);
}

export function createSupabaseWatchGroupRepository(
  supabase: SupabaseClient,
  userId: string
) {
  return {
    async list(): Promise<WatchGroup[]> {
      const { data, error } = await supabase
        .from("tr_groups")
        .select("id, name, tickers, meta, created_at, updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return sortWatchGroups(((data ?? []) as GroupRow[]).map(mapRow));
    },

    async add(name: string, sortOrder = 0): Promise<WatchGroup> {
      const { data, error } = await supabase
        .from("tr_groups")
        .insert({
          user_id: userId,
          name: name.trim(),
          visibility: "private",
          tickers: [],
          meta: { sortOrder },
        })
        .select("id, name, tickers, meta, created_at, updated_at")
        .single();
      return requireGroup(data, error);
    },

    async update(group: WatchGroup): Promise<WatchGroup> {
      const { data: current } = await supabase
        .from("tr_groups")
        .select("meta")
        .eq("id", group.id)
        .eq("user_id", userId)
        .single();
      const { data, error } = await supabase
        .from("tr_groups")
        .update({
          name: group.name.trim(),
          tickers: group.trackers,
          meta: { ...metaOf(current?.meta), sortOrder: group.sortOrder },
        })
        .eq("id", group.id)
        .eq("user_id", userId)
        .select("id, name, tickers, meta, created_at, updated_at")
        .single();
      return requireGroup(data, error);
    },

    async remove(id: string): Promise<void> {
      const { error } = await supabase
        .from("tr_groups")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}
