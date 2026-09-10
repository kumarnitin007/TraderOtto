import type { Trade } from "@/types/trade";

export type OptionLeg = {
  side: "short" | "long";
  type: "put" | "call";
  strike: number;
};

/**
 * Legs are derived from the strikes actually recorded on a trade, not from the
 * strategy name alone, so single-leg and four-leg positions can be priced too.
 */
export function tradeOptionLegs(trade: Trade): OptionLeg[] | null {
  const { strategy, shortStrike, longStrike, callShortStrike, callLongStrike } = trade;
  const legs: OptionLeg[] = [];

  const add = (side: OptionLeg["side"], type: OptionLeg["type"], strike: number | null) => {
    if (strike == null || !Number.isFinite(strike) || strike <= 0) return false;
    legs.push({ side, type, strike });
    return true;
  };

  if (strategy === "Iron Condor") {
    const complete =
      add("short", "put", shortStrike) &&
      add("long", "put", longStrike) &&
      add("short", "call", callShortStrike) &&
      add("long", "call", callLongStrike);
    return complete ? legs : null;
  }

  if (strategy === "Strangle") {
    const shortPut = add("short", "put", shortStrike);
    const shortCall = add("short", "call", callShortStrike);
    return shortPut && shortCall ? legs : null;
  }

  const type: OptionLeg["type"] = strategy.toLowerCase().includes("call") ? "call" : "put";
  if (!add("short", type, shortStrike)) return null;
  // Verticals record the protective leg in longStrike; single-leg trades leave it empty.
  add("long", type, longStrike);
  return legs;
}

export function serializeLegs(legs: OptionLeg[]): string {
  return legs.map((leg) => `${leg.side}:${leg.type}:${leg.strike}`).join(",");
}

export function parseLegs(raw: string | null): OptionLeg[] | null {
  if (!raw) return null;
  const legs: OptionLeg[] = [];
  for (const part of raw.split(",")) {
    const [side, type, strikeText] = part.split(":");
    const strike = Number(strikeText);
    if (
      (side !== "short" && side !== "long") ||
      (type !== "put" && type !== "call") ||
      !Number.isFinite(strike) ||
      strike <= 0
    ) {
      return null;
    }
    legs.push({ side, type, strike });
  }
  return legs.length ? legs : null;
}
