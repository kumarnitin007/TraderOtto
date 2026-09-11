import { fetchLatestTrades } from "@/lib/alpacaServer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();
  const { quotes, source } = await fetchLatestTrades([ticker]);
  const quote = quotes[ticker];
  if (!quote) {
    return Response.json({ error: "quote_unavailable" }, { status: 502 });
  }
  return Response.json({
    symbol: ticker,
    price: quote.price,
    ts: quote.ts,
    source,
  });
}
