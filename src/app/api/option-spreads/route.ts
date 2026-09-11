import { fetchOptionQuotes, fetchOptionSnapshots } from "@/lib/alpacaOptions";
import { occSymbol, priceSpread, type PricedSpread } from "@/lib/optionPricing";
import { parseLegs } from "@/lib/optionLegs";
import {
  maybeWriteMarketSnapshot,
  readMarketSnapshot,
  type CachedMark,
} from "@/lib/marketSnapshot";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";

type PositionBody = {
  id?: string;
  symbol?: string;
  expiry?: string;
  legs?: string;
};

async function profileClient(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function POST(request: Request) {
  let body: { positions?: PositionBody[] };
  try {
    body = (await request.json()) as { positions?: PositionBody[] };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const positions = (body.positions ?? [])
    .map((item) => {
      const id = item.id?.trim();
      const symbol = item.symbol?.toUpperCase();
      const expiry = item.expiry;
      const legs = parseLegs(item.legs ?? null);
      if (!id || !symbol || !expiry || !legs) return null;
      return { id, symbol, expiry, legs };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  if (!positions.length) {
    return Response.json({ error: "positions_required" }, { status: 400 });
  }

  const occSymbols = positions.flatMap((position) =>
    position.legs.map((leg) => occSymbol(position.symbol, position.expiry, leg))
  );
  const profile = await profileClient(request);

  const snapshotsResult = await fetchOptionSnapshots(occSymbols);
  const quotesFallback =
    snapshotsResult.ok ? { ok: true as const, quotes: {} } : await fetchOptionQuotes(occSymbols);

  const liveMarks: Record<string, PricedSpread> = {};
  if (snapshotsResult.ok || quotesFallback.ok) {
    for (const position of positions) {
      const priced = priceSpread(
        position.symbol,
        position.expiry,
        position.legs,
        snapshotsResult.ok ? snapshotsResult.snapshots : {},
        quotesFallback.ok ? quotesFallback.quotes : {}
      );
      if (priced) liveMarks[position.id] = priced;
    }
  }

  if (Object.keys(liveMarks).length) {
    const fetchedAt = new Date().toISOString();
    if (profile) {
      const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
      for (const position of positions) {
        if (!liveMarks[position.id] && snapshot?.marks[position.id]) {
          liveMarks[position.id] = snapshot.marks[position.id];
        }
      }
      const marks: Record<string, CachedMark> = {};
      for (const [id, mark] of Object.entries(liveMarks)) marks[id] = mark;
      await maybeWriteMarketSnapshot(profile.supabase, profile.userId, { marks });
    }
    return Response.json({
      marks: liveMarks,
      source: "alpaca-options",
      fetchedAt,
    });
  }

  if (profile) {
    const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
    const cached: Record<string, CachedMark> = {};
    for (const position of positions) {
      if (snapshot?.marks[position.id]) cached[position.id] = snapshot.marks[position.id];
    }
    if (Object.keys(cached).length) {
      return Response.json({
        marks: cached,
        source: "cache",
        fetchedAt: snapshot!.fetchedAt,
      });
    }
  }

  return Response.json({ error: "option_quotes_unavailable" }, { status: 404 });
}
