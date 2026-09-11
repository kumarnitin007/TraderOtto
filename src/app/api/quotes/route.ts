import { NextRequest } from "next/server";
import { fetchLatestTrades } from "@/lib/alpacaServer";

export async function GET(request: NextRequest) {
  const symbols = (request.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (!symbols.length) {
    return Response.json({ error: "symbols_required" }, { status: 400 });
  }

  try {
    const { quotes, source } = await fetchLatestTrades(symbols);
    return Response.json({ quotes, source, ts: new Date().toISOString() });
  } catch (error) {
    console.error("batch quote error", error);
    return Response.json({ error: "quotes_failed" }, { status: 502 });
  }
}
