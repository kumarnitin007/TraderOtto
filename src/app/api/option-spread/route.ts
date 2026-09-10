import { NextRequest } from "next/server";
import { parseLegs, type OptionLeg } from "@/lib/optionLegs";

type OptionQuote = {
  ap?: number;
  bp?: number;
  t?: string;
};

type OptionGreeks = {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
};

type OptionSnapshot = {
  latestQuote?: OptionQuote;
  greeks?: OptionGreeks;
  impliedVolatility?: number;
};

function occSymbol(ticker: string, expiry: string, leg: OptionLeg) {
  const [year, month, day] = expiry.split("-");
  const date = `${year.slice(-2)}${month}${day}`;
  const side = leg.type === "put" ? "P" : "C";
  const strikeCode = String(Math.round(leg.strike * 1000)).padStart(8, "0");
  return `${ticker.toUpperCase()}${date}${side}${strikeCode}`;
}

function midpoint(quote?: OptionQuote) {
  if (!quote || typeof quote.ap !== "number" || typeof quote.bp !== "number") {
    return null;
  }
  return (quote.ap + quote.bp) / 2;
}

function alpacaHeaders() {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY_ID ?? "",
    "APCA-API-SECRET-KEY": process.env.ALPACA_API_SECRET_KEY ?? "",
  };
}

async function fetchSnapshots(dataUrl: string, symbols: string[]) {
  const url = new URL("/v1beta1/options/snapshots", dataUrl);
  url.searchParams.set("symbols", symbols.join(","));
  const response = await fetch(url, { headers: alpacaHeaders(), cache: "no-store" });
  const body = await response.text();
  if (!response.ok) {
    return { ok: false as const, status: response.status, detail: body.slice(0, 300) };
  }
  try {
    const data = JSON.parse(body) as { snapshots?: Record<string, OptionSnapshot> };
    return { ok: true as const, snapshots: data.snapshots ?? {} };
  } catch {
    return { ok: false as const, status: 502, detail: "snapshot_unparseable" };
  }
}

async function fetchQuotes(dataUrl: string, symbols: string[]) {
  const url = new URL("/v1beta1/options/quotes/latest", dataUrl);
  url.searchParams.set("symbols", symbols.join(","));
  const response = await fetch(url, { headers: alpacaHeaders(), cache: "no-store" });
  const body = await response.text();
  if (!response.ok) {
    return { ok: false as const, status: response.status, detail: body.slice(0, 300) };
  }
  try {
    const data = JSON.parse(body) as { quotes?: Record<string, OptionQuote> };
    return { ok: true as const, quotes: data.quotes ?? {} };
  } catch {
    return { ok: false as const, status: 502, detail: "quote_unparseable" };
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ticker = params.get("symbol")?.toUpperCase();
  const expiry = params.get("expiry");
  const legs = parseLegs(params.get("legs"));

  if (!ticker || !expiry || !legs) {
    return Response.json({ error: "invalid_legs" }, { status: 400 });
  }

  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  const dataUrl = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";
  if (!key || !secret) {
    return Response.json({ error: "alpaca_not_configured" }, { status: 503 });
  }

  const symbols = legs.map((leg) => occSymbol(ticker, expiry, leg));
  const snapshotsResult = await fetchSnapshots(dataUrl, symbols);
  const quotesFallback =
    snapshotsResult.ok
      ? null
      : await fetchQuotes(dataUrl, symbols);

  if (!snapshotsResult.ok && quotesFallback && !quotesFallback.ok) {
    return Response.json(
      { error: "option_quote_failed", detail: quotesFallback.detail },
      { status: quotesFallback.status }
    );
  }

  let mark = 0;
  let ts: string | undefined;
  let netDelta = 0;
  let netTheta = 0;
  let netVega = 0;
  let greeksFound = 0;
  let shortIv: number | undefined;
  const priced = legs.map((leg, index) => {
    const symbol = symbols[index];
    const snapshot = snapshotsResult.ok ? snapshotsResult.snapshots[symbol] : undefined;
    const quote = snapshot?.latestQuote ?? (quotesFallback?.ok ? quotesFallback.quotes[symbol] : undefined);
    const mid = midpoint(quote);
    if (mid != null) {
      mark += leg.side === "short" ? mid : -mid;
      ts = ts ?? quote?.t;
    }
    const qty = leg.side === "short" ? -1 : 1;
    const greeks = snapshot?.greeks;
    if (greeks && typeof greeks.delta === "number") {
      netDelta += qty * greeks.delta;
      netTheta += qty * (greeks.theta ?? 0);
      netVega += qty * (greeks.vega ?? 0);
      greeksFound += 1;
    }
    if (leg.side === "short" && typeof snapshot?.impliedVolatility === "number") {
      shortIv = shortIv ?? snapshot.impliedVolatility;
    }
    return {
      symbol,
      side: leg.side,
      type: leg.type,
      strike: leg.strike,
      mid,
      iv: snapshot?.impliedVolatility,
      delta: greeks?.delta,
      theta: greeks?.theta,
      vega: greeks?.vega,
    };
  });

  if (priced.some((leg) => leg.mid == null)) {
    return Response.json(
      { error: "option_quotes_unavailable", legs: priced },
      { status: 404 }
    );
  }

  return Response.json({
    symbol: ticker,
    legs: priced,
    mark,
    ts,
    iv: shortIv,
    delta: greeksFound ? netDelta : undefined,
    theta: greeksFound ? netTheta : undefined,
    vega: greeksFound ? netVega : undefined,
    source: "alpaca-options",
  });
}
