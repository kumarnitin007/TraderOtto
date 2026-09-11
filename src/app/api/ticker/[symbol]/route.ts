import { NextRequest } from "next/server";

type Bar = { o?: number; h?: number; l?: number; c?: number; v?: number };

type NasdaqEarning = {
  symbol?: string;
  time?: string;
  epsForecast?: string;
  fiscalQuarterEnding?: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function nextEarnings(symbol: string) {
  const dates = Array.from({ length: 22 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return isoDate(date);
  });
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; TraderOtto/1.0)",
    Accept: "application/json",
  };

  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const response = await fetch(
          `https://api.nasdaq.com/api/calendar/earnings?date=${date}`,
          { headers, next: { revalidate: 21_600 } }
        );
        if (!response.ok) return null;
        const data = (await response.json()) as {
          data?: { rows?: NasdaqEarning[] | null };
        };
        const row = data.data?.rows?.find(
          (earning) => earning.symbol?.toUpperCase() === symbol
        );
        return row ? { date, ...row } : null;
      } catch {
        return null;
      }
    })
  );
  return results.find(Boolean) ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(symbol)) {
    return Response.json({ error: "invalid_symbol" }, { status: 400 });
  }

  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  const dataUrl = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";

  const [marketResult, earnings] = await Promise.all([
    key && secret
      ? fetch(`${dataUrl}/v2/stocks/${symbol}/snapshot`, {
          headers: {
            "APCA-API-KEY-ID": key,
            "APCA-API-SECRET-KEY": secret,
          },
          cache: "no-store",
        })
          .then(async (response) => {
            if (!response.ok) return null;
            return (await response.json()) as {
              latestTrade?: { p?: number; t?: string };
              dailyBar?: Bar;
              prevDailyBar?: Bar;
            };
          })
          .catch(() => null)
      : Promise.resolve(null),
    nextEarnings(symbol),
  ]);

  const price = marketResult?.latestTrade?.p ?? marketResult?.dailyBar?.c;
  const previousClose = marketResult?.prevDailyBar?.c;
  const change =
    typeof price === "number" && typeof previousClose === "number"
      ? price - previousClose
      : null;

  return Response.json({
    symbol,
    price: typeof price === "number" ? price : null,
    previousClose: previousClose ?? null,
    change,
    changePct:
      change != null && previousClose
        ? (change / previousClose) * 100
        : null,
    open: marketResult?.dailyBar?.o ?? null,
    high: marketResult?.dailyBar?.h ?? null,
    low: marketResult?.dailyBar?.l ?? null,
    volume: marketResult?.dailyBar?.v ?? null,
    ts: marketResult?.latestTrade?.t,
    earnings: earnings
      ? {
          date: earnings.date,
          timing:
            earnings.time === "time-pre-market"
              ? "Before market"
              : earnings.time === "time-after-hours"
                ? "After hours"
                : "Time not announced",
          epsForecast: earnings.epsForecast || null,
          fiscalQuarter: earnings.fiscalQuarterEnding || null,
        }
      : null,
    marketSource: marketResult ? "alpaca" : "unavailable",
    earningsSource: "nasdaq",
  });
}
