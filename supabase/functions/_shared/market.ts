import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function readSnapshot(client: SupabaseClient, userId: string) {
  const { data } = await client.from("tr_profiles").select("settings").eq("id", userId).maybeSingle();
  const settings = data?.settings && typeof data.settings === "object" ? data.settings : {};
  const value = settings.marketSnapshot;
  if (!value || typeof value !== "object" || typeof value.fetchedAt !== "string") {
    return { settings, snapshot: null };
  }
  return {
    settings,
    snapshot: {
      fetchedAt: value.fetchedAt,
      quotes: value.quotes && typeof value.quotes === "object" ? value.quotes : {},
      marks: value.marks && typeof value.marks === "object" ? value.marks : {},
    },
  };
}

export async function writeSnapshot(
  client: SupabaseClient,
  userId: string,
  patch: { quotes?: Record<string, unknown>; marks?: Record<string, unknown> },
  force = false,
) {
  const { settings, snapshot } = await readSnapshot(client, userId);
  const age = snapshot ? Date.now() - Date.parse(snapshot.fetchedAt) : Infinity;
  if (!force && age < 3 * 60 * 60 * 1000) return snapshot;
  const next = {
    fetchedAt: new Date().toISOString(),
    quotes: { ...(snapshot?.quotes ?? {}), ...(patch.quotes ?? {}) },
    marks: { ...(snapshot?.marks ?? {}), ...(patch.marks ?? {}) },
  };
  await client.from("tr_profiles").upsert({
    id: userId,
    settings: { ...settings, marketSnapshot: next },
  });
  return next;
}
