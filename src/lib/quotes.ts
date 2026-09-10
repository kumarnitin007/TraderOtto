import { seedFromString } from "@/lib/pnl";

const BASE_PRICES: Record<string, number> = {
  AAPL: 195.4,
  SPY: 572.1,
  TSLA: 254.8,
  MSFT: 429.6,
  NVDA: 139.9,
  QQQ: 483.2,
  AMD: 147.6,
  META: 612.3,
  AMZN: 231.7,
  GOOGL: 196.4,
};

export function simulatedQuote(symbol: string): { price: number; ts: string } {
  const upper = symbol.toUpperCase();
  const base = BASE_PRICES[upper] ?? 80 + (Math.abs(seedFromString(upper)) % 400);
  const jitter = (Math.random() - 0.5) * base * 0.01;
  return { price: +(base + jitter).toFixed(2), ts: new Date().toISOString() };
}
