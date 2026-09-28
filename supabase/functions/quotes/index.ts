import {
  alpaca,
  env,
  json,
  openAiObject,
  optionalUser,
  preflight,
} from "../_shared/common.ts";
import { readSnapshot, writeSnapshot } from "../_shared/market.ts";

async function latestTrades(symbols: string[]) {
  const creds = alpaca();
  const quotes: Record<string, { price: number; ts?: string }> = {};
  if (!creds.configured) return quotes;
  for (let index = 0; index < symbols.length; index += 50) {
    const group = symbols.slice(index, index + 50);
    const url = new URL("/v2/stocks/trades/latest", creds.dataUrl);
    url.searchParams.set("symbols", group.join(","));
    const response = await fetch(url, { headers: creds.headers });
    if (!response.ok) continue;
    const payload = await response.json();
    for (const symbol of group) {
      const trade = payload.trades?.[symbol];
      if (typeof trade?.p === "number") quotes[symbol] = { price: trade.p, ts: trade.t };
    }
  }
  return quotes;
}

async function technicals(symbols: string[]) {
  const creds = alpaca();
  const result: Record<string, unknown> = {};
  if (!creds.configured) return result;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 100);
  const url = new URL("/v2/stocks/bars", creds.dataUrl);
  url.searchParams.set("symbols", symbols.slice(0, 50).join(","));
  url.searchParams.set("timeframe", "1Day");
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("limit", "5000");
  url.searchParams.set("adjustment", "all");
  const response = await fetch(url, { headers: creds.headers });
  if (!response.ok) return result;
  const payload = await response.json();
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  for (const symbol of symbols) {
    const bars = (payload.bars?.[symbol] ?? []).filter(
      (bar: any) => typeof bar.c === "number" && typeof bar.v === "number",
    );
    const latest = bars.at(-1);
    if (!latest) continue;
    const avgVolume20 = average(bars.slice(-21, -1).map((bar: any) => bar.v));
    result[symbol] = {
      lastClose: latest.c,
      sma20: bars.length >= 15 ? average(bars.slice(-20).map((bar: any) => bar.c)) : null,
      sma50: bars.length >= 35 ? average(bars.slice(-50).map((bar: any) => bar.c)) : null,
      volume: latest.v,
      avgVolume20,
      volumeRatio: avgVolume20 ? latest.v / avgVolume20 : null,
      vwap: typeof latest.vw === "number" ? latest.vw : null,
      asOf: latest.t ?? null,
    };
  }
  return result;
}

async function authStatus() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY");
  if (!url || !key) return { ok: false, google: false, apple: false };
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [health, settings] = await Promise.all([
    fetch(`${url}/auth/v1/health`, { headers }),
    fetch(`${url}/auth/v1/settings`, { headers }),
  ]);
  const values = settings.ok ? await settings.json() : {};
  return {
    ok: health.ok,
    google: Boolean(values.external?.google),
    apple: Boolean(values.external?.apple),
  };
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  const url = new URL(request.url);
  const profile = await optionalUser(request);
  if (request.method === "GET") {
    if (url.searchParams.get("auth") === "1") return json(await authStatus());
    if (url.searchParams.get("ai") === "status") {
      return json({ configured: Boolean(env("OPENAI_API_KEY")) });
    }
    const aiMode = url.searchParams.get("ai");
    if (aiMode === "latest" || aiMode === "history") {
      if (!profile) return json({ error: "unauthorized" }, 401);
      const allowed = ["portfolio_summary", "watchlist_summary", "performance_review", "performance_trade_ideas", "performance_coach"];
      const kind = allowed.includes(url.searchParams.get("kind") ?? "")
        ? url.searchParams.get("kind")!
        : "portfolio_summary";
      const contextId = url.searchParams.get("contextId");
      const limit = aiMode === "latest"
        ? 1
        : Math.min(25, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
      let query = profile.client.from("tr_api_events")
        .select("id,created_at,model,tokens_in,tokens_out,captured")
        .eq("user_id", profile.user.id).eq("provider", "openai").eq("kind", kind)
        .eq("status", "success").is("deleted_at", null)
        .order("created_at", { ascending: false }).limit(limit);
      if (contextId) query = query.contains("captured", { contextId });
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      const items = (data ?? []).flatMap((row: any) => row.captured?.report ? [{
        id: row.id,
        createdAt: row.created_at,
        model: row.model,
        tokensIn: row.tokens_in,
        tokensOut: row.tokens_out,
        report: row.captured.report,
        portfolioHash: row.captured.portfolioHash ?? null,
        contextId: row.captured.contextId ?? null,
      }] : []);
      return aiMode === "latest" ? json({ saved: items[0] ?? null }) : json({ items });
    }
    if (url.searchParams.get("clock") === "1") {
      const creds = alpaca();
      const response = creds.configured
        ? await fetch(`${creds.tradingUrl}/v2/clock`, { headers: creds.headers }).catch(() => null)
        : null;
      const clock = response?.ok ? await response.json() : {};
      return json({
        session: clock.is_open ? "regular" : "closed",
        source: response?.ok ? "alpaca" : "local",
        isOpen: Boolean(clock.is_open),
        nextOpen: clock.next_open ?? null,
        nextClose: clock.next_close ?? null,
        stockIntervalMs: clock.is_open ? 30_000 : 0,
        optionIntervalMs: clock.is_open ? 30_000 : 0,
        pollStocks: Boolean(clock.is_open),
        pollOptions: Boolean(clock.is_open),
        asOfClose: !clock.is_open,
        delayed: false,
        clockAt: new Date().toISOString(),
      });
    }
    const symbols = (url.searchParams.get("symbols") ?? "").split(",")
      .map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    if (!symbols.length) return json({ error: "symbols_required" }, 400);
    if (url.searchParams.get("analytics") === "1") {
      const data = await technicals(symbols);
      return json({ technicals: data, source: Object.keys(data).length ? "alpaca" : "unavailable", fetchedAt: new Date().toISOString() });
    }
    const quotes = await latestTrades(symbols);
    let savedAt: string | null = null;
    if (profile) {
      const { snapshot } = await readSnapshot(profile.client, profile.user.id);
      for (const symbol of symbols) if (!quotes[symbol] && snapshot?.quotes[symbol]) quotes[symbol] = snapshot.quotes[symbol];
      const saved = await writeSnapshot(profile.client, profile.user.id, { quotes }, url.searchParams.get("persist") === "1");
      savedAt = saved?.fetchedAt ?? null;
    }
    const fetchedAt = new Date().toISOString();
    return Object.keys(quotes).length
      ? json({ quotes, source: "alpaca", fetchedAt, savedAt, ts: fetchedAt })
      : json({ error: "quotes_failed" }, 502);
  }

  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  const allowed = ["portfolio_summary", "watchlist_summary", "performance_review", "performance_trade_ideas", "performance_coach"];
  if (!allowed.includes(body.action) || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return json({ error: "invalid_prompt" }, 400);
  }
  const started = Date.now();
  try {
    const result = await openAiObject(body.prompt);
    let savedId = "unsaved";
    let createdAt = new Date().toISOString();
    if (profile) {
      const { data } = await profile.client.from("tr_api_events").insert({
        user_id: profile.user.id,
        provider: "openai",
        kind: body.action,
        status: "success",
        model: result.model,
        duration_ms: Date.now() - started,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        captured: {
          promptKind: body.action,
          portfolioHash: body.portfolioHash ?? null,
          contextId: body.contextId ?? null,
          report: result.value,
        },
        expires_at: new Date(Date.now() + 10 * 365 * 86_400_000).toISOString(),
      }).select("id,created_at").single();
      if (data) { savedId = data.id; createdAt = data.created_at; }
    }
    return json({
      saved: {
        id: savedId, createdAt, model: result.model,
        tokensIn: result.tokensIn, tokensOut: result.tokensOut,
        report: result.value,
        portfolioHash: body.portfolioHash ?? null,
        contextId: body.contextId ?? null,
      },
    });
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "AI summary failed." }, 502);
  }
});
