import { fetchAlpacaClock, fetchLatestTrades } from "@/lib/alpacaServer";
import { resolveSchedule } from "@/lib/marketSession";
import {
  maybeWriteMarketSnapshot,
  readMarketSnapshot,
} from "@/lib/marketSnapshot";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";
import { fetchSupabaseAuthStatus } from "@/lib/supabaseAuthStatus";

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
  if (url.searchParams.get("auth") === "1") {
    return Response.json(await fetchSupabaseAuthStatus());
  }

  const wantClock = url.searchParams.get("clock") === "1";
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (wantClock && !symbols.length) {
    const schedule = resolveSchedule(new Date(), await fetchAlpacaClock());
    return Response.json(schedule);
  }

  if (!symbols.length) {
    return Response.json({ error: "symbols_required" }, { status: 400 });
  }

  const profile = await profileClient(request);

  try {
    const { quotes, source } = await fetchLatestTrades(symbols);
    if (source === "alpaca" && Object.keys(quotes).length) {
      const fetchedAt = new Date().toISOString();
      const persist = url.searchParams.get("persist") === "1";
      let savedAt: string | null = null;
      if (profile) {
        const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
        for (const symbol of symbols) {
          if (!quotes[symbol] && snapshot?.quotes[symbol]) quotes[symbol] = snapshot.quotes[symbol];
        }
        const saved = await maybeWriteMarketSnapshot(
          profile.supabase,
          profile.userId,
          { quotes },
          { force: persist }
        );
        savedAt = saved?.fetchedAt ?? snapshot?.fetchedAt ?? null;
      }
      return Response.json({ quotes, source, fetchedAt, savedAt, ts: fetchedAt });
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
        savedAt: snapshot!.fetchedAt,
        ts: snapshot!.fetchedAt,
      });
    }
  }

  return Response.json({ error: "quotes_failed" }, { status: 502 });
}
