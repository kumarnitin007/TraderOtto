import { alpaca, env, json, preflight } from "../_shared/common.ts";

async function finnhub(path: string) {
  const token = env("FINNHUB_API_KEY");
  if (!token) return null;
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://finnhub.io/api/v1${path}${separator}token=${encodeURIComponent(token)}`);
  return response.ok ? response.json() : null;
}

async function earnings(symbol: string) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 120);
  const payload = await finnhub(
    `/calendar/earnings?from=${now.toISOString().slice(0, 10)}&to=${end.toISOString().slice(0, 10)}&symbol=${symbol}`,
  );
  const row = payload?.earningsCalendar?.[0];
  return row ? {
    date: row.date ?? null,
    timing: row.hour === "bmo" ? "Before market" : row.hour === "amc" ? "After hours" : "Time not announced",
    epsForecast: row.epsEstimate ?? null,
    fiscalQuarter: row.quarter && row.year ? `Q${row.quarter} ${row.year}` : null,
  } : null;
}

async function dailyChart(symbol: string, creds: ReturnType<typeof alpaca>) {
  if (!creds.configured) return [];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 160);
  const url = new URL("/v2/stocks/bars", creds.dataUrl);
  url.searchParams.set("symbols", symbol);
  url.searchParams.set("timeframe", "1Day");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("limit", "5000");
  url.searchParams.set("adjustment", "all");
  const response = await fetch(url, { headers: creds.headers });
  if (!response.ok) return [];
  const bars = (await response.json()).bars?.[symbol] ?? [];
  const closes = bars.map((bar: any) => bar.c);
  const average = (end: number, window: number) => {
    const values = closes.slice(end - window + 1, end + 1);
    return values.length === window ? values.reduce((a: number, b: number) => a + b, 0) / window : null;
  };
  return bars.slice(-80).map((bar: any, offset: number) => {
    const index = bars.length - Math.min(80, bars.length) + offset;
    return { t: bar.t.slice(0, 10), close: bar.c, sma20: average(index, 20), sma50: average(index, 50) };
  });
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(symbol)) return json({ error: "invalid_symbol" }, 400);
  const lite = url.searchParams.get("lite") ?? "";
  if (lite) {
    const [next, profile] = await Promise.all([
      lite !== "industry" ? earnings(symbol) : Promise.resolve(null),
      lite !== "earnings" ? finnhub(`/stock/profile2?symbol=${symbol}`) : Promise.resolve(null),
    ]);
    return json({
      symbol,
      date: next?.date ?? null,
      timing: next?.timing ?? null,
      epsForecast: next?.epsForecast ?? null,
      fiscalQuarter: next?.fiscalQuarter ?? null,
      sector: profile?.finnhubIndustry ?? null,
    });
  }
  const creds = alpaca();
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 86_400;
  const [snapshotResponse, clockResponse, newsResponse, profile, metrics, recommendation, companyNews, next, chart] = await Promise.all([
    creds.configured ? fetch(`${creds.dataUrl}/v2/stocks/${symbol}/snapshot`, { headers: creds.headers }) : null,
    creds.configured ? fetch(`${creds.tradingUrl}/v2/clock`, { headers: creds.headers }) : null,
    creds.configured ? fetch(`${creds.dataUrl}/v1beta1/news?symbols=${symbol}&limit=5&sort=desc&exclude_contentless=true`, { headers: creds.headers }) : null,
    finnhub(`/stock/profile2?symbol=${symbol}`),
    finnhub(`/stock/metric?symbol=${symbol}&metric=all`),
    finnhub(`/stock/recommendation?symbol=${symbol}`),
    finnhub(`/company-news?symbol=${symbol}&from=${new Date(weekAgo * 1000).toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`),
    earnings(symbol),
    dailyChart(symbol, creds),
  ]);
  const snapshot = snapshotResponse?.ok ? await snapshotResponse.json() : null;
  const clock = clockResponse?.ok ? await clockResponse.json() : null;
  const alpacaNews = newsResponse?.ok ? (await newsResponse.json()).news ?? [] : [];
  const price = snapshot?.latestTrade?.p ?? snapshot?.dailyBar?.c ?? null;
  const previousClose = snapshot?.prevDailyBar?.c ?? null;
  const change = typeof price === "number" && typeof previousClose === "number" ? price - previousClose : null;
  const news = [
    ...alpacaNews.map((article: any) => ({
      id: `alpaca-${article.id}`, headline: article.headline, summary: article.summary ?? "",
      source: article.source ?? "Alpaca", provider: "alpaca", createdAt: article.created_at ?? "", url: article.url ?? null,
    })),
    ...(companyNews ?? []).slice(0, 5).map((article: any) => ({
      id: `finnhub-${article.id}`, headline: article.headline, summary: article.summary ?? "",
      source: article.source ?? "Finnhub", provider: "finnhub",
      createdAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : "", url: article.url ?? null,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  return json({
    symbol, price, previousClose, change,
    changePct: change != null && previousClose ? change / previousClose * 100 : null,
    open: snapshot?.dailyBar?.o ?? null, high: snapshot?.dailyBar?.h ?? null,
    low: snapshot?.dailyBar?.l ?? null, volume: snapshot?.dailyBar?.v ?? null,
    ts: snapshot?.latestTrade?.t, earnings: next,
    market: clock ? { isOpen: clock.is_open, nextOpen: clock.next_open, nextClose: clock.next_close } : null,
    corporateActions: [], news,
    company: profile ? {
      name: profile.name ?? symbol, ticker: symbol, exchange: profile.exchange ?? "",
      industry: profile.finnhubIndustry ?? "", logo: profile.logo ?? "", weburl: profile.weburl ?? "",
      marketCapitalization: profile.marketCapitalization ?? null,
    } : null,
    fundamentals: metrics?.metric ?? null,
    analyst: recommendation?.[0] ?? null,
    providers: { alpaca: Boolean(snapshot), finnhub: Boolean(env("FINNHUB_API_KEY")), finnhubConfigured: Boolean(env("FINNHUB_API_KEY")) },
    marketSource: snapshot ? "alpaca" : "unavailable",
    earningsSource: next ? "finnhub" : "unavailable",
    chart,
  });
});
