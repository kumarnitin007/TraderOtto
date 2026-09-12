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
