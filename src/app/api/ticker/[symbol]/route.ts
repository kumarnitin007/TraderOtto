import { NextRequest } from "next/server";
import type { CorporateAction, TickerNews } from "@/types/tickerDetails";
import { getFinnhubIndustry, getFinnhubTickerDetails } from "@/lib/finnhub";
import { lookupNextEarnings } from "@/lib/nextEarnings";

type Bar = { o?: number; h?: number; l?: number; c?: number; v?: number };

type NasdaqEarning = {
  symbol?: string;
  time?: string;
  epsForecast?: string;
  fiscalQuarterEnding?: string;
};

type AlpacaNews = {
  id?: number;
  headline?: string;
  summary?: string;
  source?: string;
  created_at?: string;
  url?: string | null;
};

type AlpacaClock = {
  is_open?: boolean;
  next_open?: string;
  next_close?: string;
};

type RawCorporateAction = Record<string, unknown>;

const alpacaHeaders = (key: string, secret: string) => ({
  "APCA-API-KEY-ID": key,
  "APCA-API-SECRET-KEY": secret,
});

function actionLabel(type: string, action: RawCorporateAction) {
  const title = type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (type === "cash_dividends" && typeof action.rate === "number") {
    return `${title}: $${action.rate.toFixed(3)} per share`;
  }
  const oldRate = action.old_rate;
  const newRate = action.new_rate;
  if (
    (type === "forward_splits" || type === "reverse_splits") &&
    typeof oldRate === "number" &&
    typeof newRate === "number"
  ) {
    return `${title}: ${newRate}:${oldRate}`;
  }
  return title;
}

function flattenCorporateActions(payload: unknown): CorporateAction[] {
  const groups = (payload as { corporate_actions?: Record<string, unknown> } | null)
    ?.corporate_actions;
  if (!groups) return [];

  return Object.entries(groups)
    .flatMap(([type, items]) =>
      Array.isArray(items)
        ? items.map((item) => {
            const action = item as RawCorporateAction;
            const date =
              action.ex_date ?? action.process_date ?? action.record_date ?? null;
            return {
              type,
              date: typeof date === "string" ? date : null,
              label: actionLabel(type, action),
            };
          })
        : []
    )
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, 5);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function nextEarnings(symbol: string) {
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
    if (match) return match;
  }
  return null;
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

  const lite = _request.nextUrl.searchParams.get("lite") ?? "";
  if (lite === "earnings" || lite === "industry" || lite === "1") {
    const wantEarnings = lite === "earnings" || lite === "1";
    const wantIndustry = lite === "industry" || lite === "1";
    const [earnings, sector] = await Promise.all([
      wantEarnings ? lookupNextEarnings(symbol) : Promise.resolve(null),
      wantIndustry ? getFinnhubIndustry(symbol) : Promise.resolve(null),
    ]);
    return Response.json({
      symbol,
      date: earnings?.date ?? null,
      timing: earnings?.timing ?? null,
      epsForecast: earnings?.epsForecast ?? null,
      fiscalQuarter: earnings?.fiscalQuarter ?? null,
      sector: sector ?? null,
    });
  }

  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  const dataUrl = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";
  const tradingUrl =
    process.env.ALPACA_TRADING_URL ?? "https://paper-api.alpaca.markets";
  const headers = key && secret ? alpacaHeaders(key, secret) : null;
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const end = new Date();
  end.setDate(end.getDate() + 120);

  const [
    marketResult,
    nasdaqEarnings,
    marketClock,
    corporatePayload,
    newsPayload,
    finnhub,
  ] =
    await Promise.all([
    headers
      ? fetch(`${dataUrl}/v2/stocks/${symbol}/snapshot`, {
          headers,
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
    headers
      ? fetch(`${tradingUrl}/v2/clock`, {
          headers,
          next: { revalidate: 60 },
        })
          .then(async (response) =>
            response.ok ? ((await response.json()) as AlpacaClock) : null
          )
          .catch(() => null)
      : Promise.resolve(null),
    headers
      ? fetch(
          `${dataUrl}/v1/corporate-actions?symbols=${encodeURIComponent(symbol)}&start=${isoDate(start)}&end=${isoDate(end)}&limit=20`,
          { headers, next: { revalidate: 3_600 } }
        )
          .then(async (response) => (response.ok ? response.json() : null))
          .catch(() => null)
      : Promise.resolve(null),
    headers
      ? fetch(
          `${dataUrl}/v1beta1/news?symbols=${encodeURIComponent(symbol)}&limit=5&sort=desc&exclude_contentless=true`,
          { headers, next: { revalidate: 300 } }
        )
          .then(async (response) =>
            response.ok
              ? ((await response.json()) as { news?: AlpacaNews[] })
              : null
          )
          .catch(() => null)
      : Promise.resolve(null),
    getFinnhubTickerDetails(symbol),
  ]);

  const price = marketResult?.latestTrade?.p ?? marketResult?.dailyBar?.c;
  const previousClose = marketResult?.prevDailyBar?.c;
  const change =
    typeof price === "number" && typeof previousClose === "number"
      ? price - previousClose
      : null;
  const news: TickerNews[] = (newsPayload?.news ?? [])
    .filter(
      (article): article is AlpacaNews & { id: number; headline: string } =>
        typeof article.id === "number" && typeof article.headline === "string"
    )
    .map((article) => ({
      id: `alpaca-${article.id}`,
      headline: article.headline,
      summary: article.summary ?? "",
      source: article.source ?? "Alpaca",
      provider: "alpaca" as const,
      createdAt: article.created_at ?? "",
      url: article.url ?? null,
    }));
  const mergedNews = [...news, ...(finnhub.news ?? [])]
    .filter(
      (article, index, articles) =>
        articles.findIndex(
          (candidate) =>
            candidate.headline.toLowerCase() === article.headline.toLowerCase()
        ) === index
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 10);
  const earnings = finnhub.earnings ??
    (nasdaqEarnings
      ? {
          date: nasdaqEarnings.date,
          timing:
            nasdaqEarnings.time === "time-pre-market"
              ? "Before market"
              : nasdaqEarnings.time === "time-after-hours"
                ? "After hours"
                : "Time not announced",
          epsForecast: nasdaqEarnings.epsForecast || null,
          fiscalQuarter: nasdaqEarnings.fiscalQuarterEnding || null,
        }
      : null);

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
    earnings,
    market:
      typeof marketClock?.is_open === "boolean" &&
      marketClock.next_open &&
      marketClock.next_close
        ? {
            isOpen: marketClock.is_open,
            nextOpen: marketClock.next_open,
            nextClose: marketClock.next_close,
          }
        : null,
    corporateActions: flattenCorporateActions(corporatePayload),
    news: mergedNews,
    company: finnhub.company ?? null,
    fundamentals: finnhub.fundamentals ?? null,
    analyst: finnhub.analyst ?? null,
    providers: {
      alpaca: Boolean(marketResult),
      finnhub: finnhub.available,
      finnhubConfigured: finnhub.configured,
    },
    marketSource: marketResult ? "alpaca" : "unavailable",
    earningsSource: finnhub.earnings ? "finnhub" : "nasdaq",
  });
}
