import { fetchLatestTrades } from "@/lib/alpacaServer";
import {
  maybeWriteMarketSnapshot,
  readMarketSnapshot,
} from "@/lib/marketSnapshot";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";

async function profileClient(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    return Response.json({ error: "symbols_required" }, { status: 400 });
  }

  const profile = await profileClient(request);

  try {
    const { quotes, source } = await fetchLatestTrades(symbols);
    if (source === "alpaca" && Object.keys(quotes).length) {
      const fetchedAt = new Date().toISOString();
      if (profile) {
        const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
        for (const symbol of symbols) {
          if (!quotes[symbol] && snapshot?.quotes[symbol]) quotes[symbol] = snapshot.quotes[symbol];
        }
        await maybeWriteMarketSnapshot(profile.supabase, profile.userId, { quotes });
      }
      return Response.json({ quotes, source, fetchedAt, ts: fetchedAt });
    }
  } catch (error) {
    console.error("batch quote error", error);
  }

  if (profile) {
    const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
    const cached: Record<string, { price: number; ts?: string }> = {};
    for (const symbol of symbols) {
      if (snapshot?.quotes[symbol]) cached[symbol] = snapshot.quotes[symbol];
    }
    if (Object.keys(cached).length) {
      return Response.json({
        quotes: cached,
        source: "cache",
        fetchedAt: snapshot!.fetchedAt,
        ts: snapshot!.fetchedAt,
      });
    }
  }

  return Response.json({ error: "quotes_failed" }, { status: 502 });
}
