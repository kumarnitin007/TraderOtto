import { NextRequest } from "next/server";
import { fetchOptionQuotes, fetchOptionSnapshots } from "@/lib/alpacaOptions";
import { occSymbol, priceSpread } from "@/lib/optionPricing";
import { parseLegs } from "@/lib/optionLegs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ticker = params.get("symbol")?.toUpperCase();
  const expiry = params.get("expiry");
  const legs = parseLegs(params.get("legs"));

  if (!ticker || !expiry || !legs) {
    return Response.json({ error: "invalid_legs" }, { status: 400 });
  }

  const symbols = legs.map((leg) => occSymbol(ticker, expiry, leg));
  const snapshotsResult = await fetchOptionSnapshots(symbols);
  const quotesFallback = snapshotsResult.ok ? { ok: true as const, quotes: {} } : await fetchOptionQuotes(symbols);

  if (!snapshotsResult.ok && !quotesFallback.ok) {
    return Response.json(
      { error: "option_quote_failed", detail: quotesFallback.detail },
      { status: quotesFallback.status }
    );
  }

  const priced = priceSpread(
    ticker,
    expiry,
    legs,
    snapshotsResult.ok ? snapshotsResult.snapshots : {},
    quotesFallback.ok ? quotesFallback.quotes : {}
  );
  if (!priced) {
    return Response.json({ error: "option_quotes_unavailable" }, { status: 404 });
  }

  return Response.json({
    symbol: ticker,
    ...priced,
    source: "alpaca-options",
  });
}
