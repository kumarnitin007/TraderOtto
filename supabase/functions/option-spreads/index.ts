import { alpaca, json, optionalUser, preflight } from "../_shared/common.ts";
import { readSnapshot, writeSnapshot } from "../_shared/market.ts";

type Leg = { side: "short" | "long"; type: "put" | "call"; strike: number };

function legs(raw: string): Leg[] | null {
  const result: Leg[] = [];
  for (const part of raw.split(",")) {
    const [side, type, strikeText] = part.split(":");
    const strike = Number(strikeText);
    if (!["short", "long"].includes(side) || !["put", "call"].includes(type) || !(strike > 0)) return null;
    result.push({ side, type, strike } as Leg);
  }
  return result.length ? result : null;
}

function occ(ticker: string, expiry: string, leg: Leg) {
  const [year, month, day] = expiry.split("-");
  return `${ticker}${year.slice(-2)}${month}${day}${leg.type === "put" ? "P" : "C"}${String(Math.round(leg.strike * 1000)).padStart(8, "0")}`;
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  const positions = (body.positions ?? []).flatMap((item: any) => {
    const parsed = legs(item.legs ?? "");
    return item.id && item.symbol && item.expiry && parsed
      ? [{ id: String(item.id), symbol: String(item.symbol).toUpperCase(), expiry: item.expiry, legs: parsed }]
      : [];
  });
  if (!positions.length) return json({ error: "positions_required" }, 400);
  const creds = alpaca();
  if (!creds.configured) return json({ error: "alpaca_not_configured" }, 503);
  const symbols = [...new Set(positions.flatMap((position: any) =>
    position.legs.map((leg: Leg) => occ(position.symbol, position.expiry, leg))))];
  const snapshots: Record<string, any> = {};
  for (let index = 0; index < symbols.length; index += 50) {
    const url = new URL("/v1beta1/options/snapshots", creds.dataUrl);
    url.searchParams.set("symbols", symbols.slice(index, index + 50).join(","));
    const response = await fetch(url, { headers: creds.headers });
    if (response.ok) Object.assign(snapshots, (await response.json()).snapshots ?? {});
  }
  const marks: Record<string, any> = {};
  for (const position of positions) {
    let mark = 0, delta = 0, theta = 0, vega = 0, count = 0;
    let ts: string | undefined, iv: number | undefined, valid = true;
    for (const leg of position.legs) {
      const snapshot = snapshots[occ(position.symbol, position.expiry, leg)];
      const quote = snapshot?.latestQuote;
      if (typeof quote?.ap !== "number" || typeof quote?.bp !== "number") { valid = false; break; }
      const sign = leg.side === "short" ? 1 : -1;
      mark += sign * (quote.ap + quote.bp) / 2;
      ts ||= quote.t;
      if (snapshot.greeks && typeof snapshot.greeks.delta === "number") {
        const qty = leg.side === "short" ? -1 : 1;
        delta += qty * snapshot.greeks.delta;
        theta += qty * (snapshot.greeks.theta ?? 0);
        vega += qty * (snapshot.greeks.vega ?? 0);
        count++;
      }
      if (leg.side === "short" && typeof snapshot.impliedVolatility === "number") iv ??= snapshot.impliedVolatility;
    }
    if (valid) marks[position.id] = { mark, ts, iv, delta: count ? delta : undefined, theta: count ? theta : undefined, vega: count ? vega : undefined };
  }
  const profile = await optionalUser(request);
  let savedAt: string | null = null;
  if (profile) {
    const { snapshot } = await readSnapshot(profile.client, profile.user.id);
    for (const position of positions) if (!marks[position.id] && snapshot?.marks[position.id]) marks[position.id] = snapshot.marks[position.id];
    const saved = await writeSnapshot(profile.client, profile.user.id, { marks }, Boolean(body.persist));
    savedAt = saved?.fetchedAt ?? null;
  }
  return Object.keys(marks).length
    ? json({ marks, source: "alpaca-options", fetchedAt: new Date().toISOString(), savedAt })
    : json({ error: "option_quotes_unavailable" }, 404);
});
