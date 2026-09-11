import { getFinnhubNextEarnings, type CachedEarnings } from "@/lib/finnhub";

type NasdaqEarning = {
  symbol?: string;
  time?: string;
  epsForecast?: string;
  fiscalQuarterEnding?: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function nasdaqNextEarnings(symbol: string): Promise<CachedEarnings | null> {
  const dates = Array.from({ length: 93 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return isoDate(date);
  });
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; TraderOtto/1.0)",
    Accept: "application/json",
  };

  for (let start = 0; start < dates.length; start += 10) {
    const batch = dates.slice(start, start + 10);
    const results = await Promise.all(
      batch.map(async (date) => {
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
    const match = results.find(Boolean);
    if (!match) continue;
    return {
      date: match.date,
      timing:
        match.time === "time-pre-market"
          ? "Before market"
          : match.time === "time-after-hours"
            ? "After hours"
            : "Time not announced",
      epsForecast: match.epsForecast || null,
      fiscalQuarter: match.fiscalQuarterEnding || null,
    };
  }
  return null;
}

/** Finnhub first; Nasdaq calendar only if Finnhub has no date. */
export async function lookupNextEarnings(symbol: string): Promise<CachedEarnings | null> {
  const finnhub = await getFinnhubNextEarnings(symbol);
  if (finnhub.earnings) return finnhub.earnings;
  return nasdaqNextEarnings(symbol);
}
