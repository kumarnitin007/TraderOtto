import type { SupabaseClient } from "@supabase/supabase-js";

export const MARKET_SNAPSHOT_MIN_MS = 3 * 60 * 60 * 1000;

export type CachedQuote = { price: number; ts?: string };
export type CachedMark = {
  mark: number;
  ts?: string;
  iv?: number;
  delta?: number;
  theta?: number;
  vega?: number;
};

export type MarketSnapshot = {
  fetchedAt: string;
  quotes: Record<string, CachedQuote>;
  marks: Record<string, CachedMark>;
};

function asSnapshot(value: unknown): MarketSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<MarketSnapshot>;
  if (typeof row.fetchedAt !== "string") return null;
  return {
    fetchedAt: row.fetchedAt,
    quotes: row.quotes && typeof row.quotes === "object" ? row.quotes : {},
    marks: row.marks && typeof row.marks === "object" ? row.marks : {},
  };
}

async function profileSettings(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tr_profiles")
    .select("settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings =
    data?.settings && typeof data.settings === "object"
      ? (data.settings as Record<string, unknown>)
      : {};
  return settings;
}

export async function readMarketSnapshot(supabase: SupabaseClient, userId: string) {
  try {
    const settings = await profileSettings(supabase, userId);
    return asSnapshot(settings.marketSnapshot);
  } catch {
    return null;
  }
}

export async function maybeWriteMarketSnapshot(
  supabase: SupabaseClient,
  userId: string,
  patch: { quotes?: Record<string, CachedQuote>; marks?: Record<string, CachedMark> }
) {
  try {
    const settings = await profileSettings(supabase, userId);
    const existing = asSnapshot(settings.marketSnapshot);
    const age = existing ? Date.now() - Date.parse(existing.fetchedAt) : Number.POSITIVE_INFINITY;
    if (Number.isFinite(age) && age < MARKET_SNAPSHOT_MIN_MS) return existing;
    const snapshot: MarketSnapshot = {
      fetchedAt: new Date().toISOString(),
      quotes: { ...(existing?.quotes ?? {}), ...(patch.quotes ?? {}) },
      marks: { ...(existing?.marks ?? {}), ...(patch.marks ?? {}) },
    };
    const { error } = await supabase.from("tr_profiles").upsert({
      id: userId,
      settings: { ...settings, marketSnapshot: snapshot },
    });
    if (error) return existing;
    return snapshot;
  } catch {
    return null;
  }
}
