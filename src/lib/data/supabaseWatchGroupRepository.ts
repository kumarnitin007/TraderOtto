import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchGroup, WatchTracker } from "@/types/watchGroup";

type GroupRow = {
  id: string;
  name: string;
  tickers: unknown;
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
      },
    ];
  });
}

function mapRow(row: GroupRow): WatchGroup {
  return {
    id: row.id,
    name: row.name,
    trackers: trackers(row.tickers),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
        .select("id, name, tickers, created_at, updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as GroupRow[]).map(mapRow);
    },

    async add(name: string): Promise<WatchGroup> {
      const { data, error } = await supabase
        .from("tr_groups")
        .insert({
          user_id: userId,
          name: name.trim(),
          visibility: "private",
          tickers: [],
        })
        .select("id, name, tickers, created_at, updated_at")
        .single();
      return requireGroup(data, error);
    },

    async update(group: WatchGroup): Promise<WatchGroup> {
      const { data, error } = await supabase
        .from("tr_groups")
        .update({
          name: group.name.trim(),
          tickers: group.trackers,
        })
        .eq("id", group.id)
        .eq("user_id", userId)
        .select("id, name, tickers, created_at, updated_at")
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
