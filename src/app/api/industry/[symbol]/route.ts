import { NextRequest } from "next/server";
import { getFinnhubIndustry } from "@/lib/finnhub";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(symbol)) {
    return Response.json({ error: "invalid_symbol" }, { status: 400 });
  }
  const sector = await getFinnhubIndustry(symbol);
  return Response.json({ symbol, sector });
}
