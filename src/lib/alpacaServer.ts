export function alpacaCredentials() {
  const key = process.env.ALPACA_API_KEY_ID ?? "";
  const secret = process.env.ALPACA_API_SECRET_KEY ?? "";
  return {
    key,
    secret,
    configured: Boolean(key && secret),
    dataUrl: process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets",
    tradingUrl: process.env.ALPACA_TRADING_URL ?? "https://paper-api.alpaca.markets",
  };
}

export function alpacaHeaders(key: string, secret: string) {
  return {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
  };
}

export async function fetchAlpacaClock() {
  const creds = alpacaCredentials();
  if (!creds.configured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${creds.tradingUrl}/v2/clock`, {
      headers: alpacaHeaders(creds.key, creds.secret),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as {
      timestamp?: string;
      is_open?: boolean;
      next_open?: string;
      next_close?: string;
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type LatestTrade = { price: number; ts?: string };

type DailyBar = {
  c?: number;
  v?: number;
  vw?: number;
  t?: string;
};

export type TickerTechnical = {
  lastClose: number;
  sma20: number | null;
  sma50: number | null;
  volume: number;
  avgVolume20: number | null;
  volumeRatio: number | null;
  vwap: number | null;
  asOf: string | null;
};

export type DailyChartPoint = {
  t: string;
  close: number;
  sma20: number | null;
  sma50: number | null;
};

function rollingAverage(values: number[], end: number, window: number) {
  const start = end - window + 1;
  if (start < 0) return null;
  let sum = 0;
  for (let index = start; index <= end; index += 1) {
    const value = values[index];
    if (typeof value !== "number") return null;
    sum += value;
  }
  return sum / window;
}

function parseTrade(value: unknown): LatestTrade | null {
  const trade = value as { p?: number; t?: string } | undefined;
  if (typeof trade?.p !== "number") return null;
  return { price: trade.p, ts: trade.t };
}

export async function fetchLatestTrades(symbols: string[]) {
  const unique = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()).filter(Boolean)));
  const quotes: Record<string, LatestTrade> = {};
  const creds = alpacaCredentials();

  if (!unique.length || !creds.configured) {
    return { quotes, source: "unavailable" as const };
  }

  const headers = alpacaHeaders(creds.key, creds.secret);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) chunks.push(unique.slice(i, i + 50));

  for (const chunk of chunks) {
    const url = new URL("/v2/stocks/trades/latest", creds.dataUrl);
    url.searchParams.set("symbols", chunk.join(","));
    const response = await fetch(url, { headers, cache: "no-store" });
    if (response.ok) {
      const body = await response.text();
      try {
        const data = JSON.parse(body) as { trades?: Record<string, unknown> };
        for (const symbol of chunk) {
          const parsed = parseTrade(data.trades?.[symbol]);
          if (parsed) quotes[symbol] = parsed;
        }
        continue;
      } catch {
        /* fall through to per-symbol */
      }
    }

    await Promise.all(
      chunk.map(async (symbol) => {
        if (quotes[symbol]) return;
        const single = await fetch(`${creds.dataUrl}/v2/stocks/${symbol}/trades/latest`, {
          headers,
          cache: "no-store",
        });
        if (!single.ok) return;
        try {
          const parsed = parseTrade(
            (JSON.parse(await single.text()) as { trade?: unknown }).trade
          );
          if (parsed) quotes[symbol] = parsed;
        } catch {
          /* ignore */
        }
      })
    );
  }

  if (!Object.keys(quotes).length) {
    return { quotes, source: "unavailable" as const };
  }

  return { quotes, source: "alpaca" as const };
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

/** Daily price/volume context used by local and AI portfolio analysis. */
export async function fetchTickerTechnicals(symbols: string[]) {
  const unique = Array.from(
    new Set(symbols.map((symbol) => symbol.toUpperCase()).filter(Boolean))
  ).slice(0, 50);
  const technicals: Record<string, TickerTechnical> = {};
  const creds = alpacaCredentials();
  if (!unique.length || !creds.configured) return technicals;

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 100);
  const url = new URL("/v2/stocks/bars", creds.dataUrl);
  url.searchParams.set("symbols", unique.join(","));
  url.searchParams.set("timeframe", "1Day");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("limit", "5000");
  url.searchParams.set("adjustment", "all");
  const response = await fetch(url, {
    headers: alpacaHeaders(creds.key, creds.secret),
    next: { revalidate: 900 },
  });
  if (!response.ok) return technicals;

  const payload = (await response.json()) as {
    bars?: Record<string, DailyBar[]>;
  };
  for (const symbol of unique) {
    const bars = (payload.bars?.[symbol] ?? []).filter(
      (bar): bar is DailyBar & { c: number; v: number } =>
        typeof bar.c === "number" && typeof bar.v === "number"
    );
    const latest = bars.at(-1);
    if (!latest) continue;
    const prior20 = bars.slice(-21, -1);
    const closes20 = bars.slice(-20).map((bar) => bar.c);
    const closes50 = bars.slice(-50).map((bar) => bar.c);
    const avgVolume20 = average(prior20.map((bar) => bar.v));
    technicals[symbol] = {
      lastClose: latest.c,
      sma20: closes20.length >= 15 ? average(closes20) : null,
      sma50: closes50.length >= 35 ? average(closes50) : null,
      volume: latest.v,
      avgVolume20,
      volumeRatio: avgVolume20 ? latest.v / avgVolume20 : null,
      vwap: typeof latest.vw === "number" ? latest.vw : null,
      asOf: latest.t ?? null,
    };
  }
  return technicals;
}

/** Last ~80 daily closes plus SMA20/SMA50, from the same Alpaca bars feed. */
export async function fetchDailyChart(symbol: string) {
  const creds = alpacaCredentials();
  const ticker = symbol.toUpperCase();
  if (!creds.configured || !ticker) return [];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 160);
  const url = new URL("/v2/stocks/bars", creds.dataUrl);
  url.searchParams.set("symbols", ticker);
  url.searchParams.set("timeframe", "1Day");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("limit", "5000");
  url.searchParams.set("adjustment", "all");
  const response = await fetch(url, {
    headers: alpacaHeaders(creds.key, creds.secret),
    next: { revalidate: 900 },
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    bars?: Record<string, DailyBar[]>;
  };
  const bars = (payload.bars?.[ticker] ?? []).filter(
    (bar): bar is DailyBar & { c: number; t: string } =>
      typeof bar.c === "number" && typeof bar.t === "string"
  );
  const closes = bars.map((bar) => bar.c);
  const points: DailyChartPoint[] = bars.map((bar, index) => ({
    t: bar.t.slice(0, 10),
    close: bar.c,
    sma20: rollingAverage(closes, index, 20),
    sma50: rollingAverage(closes, index, 50),
  }));
  return points.slice(-80);
}
