import { NextRequest } from "next/server";
import { simulatedQuote } from "@/lib/quotes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  const dataUrl = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";

  if (!key || !secret) {
    const sim = simulatedQuote(ticker);
    return Response.json({
      symbol: ticker,
      price: sim.price,
      ts: sim.ts,
      source: "simulated",
    });
  }

  const res = await fetch(`${dataUrl}/v2/stocks/${ticker}/trades/latest`, {
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Alpaca quote error", res.status, errBody);
    return Response.json(
      { error: "quote_failed", alpacaStatus: res.status, alpacaBody: errBody },
      { status: 502 }
    );
  }

  // Alpaca occasionally returns an empty body, which would throw on res.json().
  const body = await res.text();
  let trade: { p?: number; t?: string } | undefined;
  try {
    trade = (JSON.parse(body) as { trade?: { p?: number; t?: string } }).trade;
  } catch {
    return Response.json({ error: "quote_unparseable" }, { status: 502 });
  }

  if (typeof trade?.p !== "number") {
    return Response.json({ error: "quote_unavailable" }, { status: 502 });
  }

  return Response.json({
    symbol: ticker,
    price: trade.p,
    ts: trade.t,
    source: "alpaca",
  });
}
