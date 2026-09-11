import type { OptionLeg } from "@/lib/optionLegs";

export type OptionQuote = {
  ap?: number;
  bp?: number;
  t?: string;
};

export type OptionGreeks = {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
};

export type OptionSnapshot = {
  latestQuote?: OptionQuote;
  greeks?: OptionGreeks;
  impliedVolatility?: number;
};

export type PricedSpread = {
  mark: number;
  ts?: string;
  iv?: number;
  delta?: number;
  theta?: number;
  vega?: number;
};

export function occSymbol(ticker: string, expiry: string, leg: OptionLeg) {
  const [year, month, day] = expiry.split("-");
  const date = `${year.slice(-2)}${month}${day}`;
  const side = leg.type === "put" ? "P" : "C";
  const strikeCode = String(Math.round(leg.strike * 1000)).padStart(8, "0");
  return `${ticker.toUpperCase()}${date}${side}${strikeCode}`;
}

export function midpoint(quote?: OptionQuote) {
  if (!quote || typeof quote.ap !== "number" || typeof quote.bp !== "number") {
    return null;
  }
  return (quote.ap + quote.bp) / 2;
}

export function priceSpread(
  ticker: string,
  expiry: string,
  legs: OptionLeg[],
  snapshots: Record<string, OptionSnapshot>,
  quotes: Record<string, OptionQuote>
): PricedSpread | null {
  let mark = 0;
  let ts: string | undefined;
  let netDelta = 0;
  let netTheta = 0;
  let netVega = 0;
  let greeksFound = 0;
  let shortIv: number | undefined;

  for (const leg of legs) {
    const symbol = occSymbol(ticker, expiry, leg);
    const snapshot = snapshots[symbol];
    const quote = snapshot?.latestQuote ?? quotes[symbol];
    const mid = midpoint(quote);
    if (mid == null) return null;
    mark += leg.side === "short" ? mid : -mid;
    ts = ts ?? quote?.t;
    const qty = leg.side === "short" ? -1 : 1;
    const greeks = snapshot?.greeks;
    if (greeks && typeof greeks.delta === "number") {
      netDelta += qty * greeks.delta;
      netTheta += qty * (greeks.theta ?? 0);
      netVega += qty * (greeks.vega ?? 0);
      greeksFound += 1;
    }
    if (leg.side === "short" && typeof snapshot?.impliedVolatility === "number") {
      shortIv = shortIv ?? snapshot.impliedVolatility;
    }
  }

  return {
    mark,
    ts,
    iv: shortIv,
    delta: greeksFound ? netDelta : undefined,
    theta: greeksFound ? netTheta : undefined,
    vega: greeksFound ? netVega : undefined,
  };
}
