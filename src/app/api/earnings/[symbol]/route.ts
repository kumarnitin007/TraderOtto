import { NextRequest } from "next/server";
import { lookupNextEarnings } from "@/lib/nextEarnings";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(symbol)) {
    return Response.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const earnings = await lookupNextEarnings(symbol);
  return Response.json({
    symbol,
    date: earnings?.date ?? null,
    timing: earnings?.timing ?? null,
    epsForecast: earnings?.epsForecast ?? null,
    fiscalQuarter: earnings?.fiscalQuarter ?? null,
  });
}
