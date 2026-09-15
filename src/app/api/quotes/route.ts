import {
  fetchAlpacaClock,
  fetchLatestTrades,
  fetchTickerTechnicals,
} from "@/lib/alpacaServer";
import { resolveSchedule } from "@/lib/marketSession";
import {
  maybeWriteMarketSnapshot,
  readMarketSnapshot,
} from "@/lib/marketSnapshot";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";
import { fetchSupabaseAuthStatus } from "@/lib/supabaseAuthStatus";
import {
  createPortfolioAiReport,
  createWatchlistAiReport,
  isOpenAiConfigured,
} from "@/lib/positionsAiServer";

export const maxDuration = 60;

async function profileClient(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("auth") === "1") {
    return Response.json(await fetchSupabaseAuthStatus());
  }

  if (url.searchParams.get("ai") === "status") {
    return Response.json({ configured: isOpenAiConfigured() });
  }

  if (url.searchParams.get("ai") === "latest") {
    const profile = await profileClient(request);
    if (!profile) return Response.json({ error: "unauthorized" }, { status: 401 });
    const kind =
      url.searchParams.get("kind") === "watchlist_summary"
        ? "watchlist_summary"
        : "portfolio_summary";
    const contextId = url.searchParams.get("contextId");
    let query = profile.supabase
      .from("tr_api_events")
      .select("id,created_at,model,tokens_in,tokens_out,captured")
      .eq("user_id", profile.userId)
      .eq("provider", "openai")
      .eq("kind", kind)
      .eq("status", "success")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (kind === "watchlist_summary" && contextId) {
      query = query.contains("captured", { contextId });
    }
    const { data, error } = await query.maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ report: null });
    const captured = data.captured as {
      report?: unknown;
      portfolioHash?: string;
      contextId?: string;
    };
    return Response.json({
      saved: {
        id: data.id,
        createdAt: data.created_at,
        model: data.model,
        tokensIn: data.tokens_in,
        tokensOut: data.tokens_out,
        report: captured.report ?? null,
        portfolioHash: captured.portfolioHash ?? null,
        contextId: captured.contextId ?? null,
      },
    });
  }

  const wantClock = url.searchParams.get("clock") === "1";
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (wantClock && !symbols.length) {
    const schedule = resolveSchedule(new Date(), await fetchAlpacaClock());
    return Response.json(schedule);
  }

  if (!symbols.length) {
    return Response.json({ error: "symbols_required" }, { status: 400 });
  }

  if (url.searchParams.get("analytics") === "1") {
    try {
      const technicals = await fetchTickerTechnicals(symbols);
      return Response.json({
        technicals,
        source: Object.keys(technicals).length ? "alpaca" : "unavailable",
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("technical analytics error", error);
      return Response.json({ error: "analytics_failed" }, { status: 502 });
    }
  }

  const profile = await profileClient(request);

  try {
    const { quotes, source } = await fetchLatestTrades(symbols);
    if (source === "alpaca" && Object.keys(quotes).length) {
      const fetchedAt = new Date().toISOString();
      const persist = url.searchParams.get("persist") === "1";
      let savedAt: string | null = null;
      if (profile) {
        const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
        for (const symbol of symbols) {
          if (!quotes[symbol] && snapshot?.quotes[symbol]) quotes[symbol] = snapshot.quotes[symbol];
        }
        const saved = await maybeWriteMarketSnapshot(
          profile.supabase,
          profile.userId,
          { quotes },
          { force: persist }
        );
        savedAt = saved?.fetchedAt ?? snapshot?.fetchedAt ?? null;
      }
      return Response.json({ quotes, source, fetchedAt, savedAt, ts: fetchedAt });
    }
  } catch (error) {
    console.error("batch quote error", error);
  }

  if (profile) {
    const snapshot = await readMarketSnapshot(profile.supabase, profile.userId);
    const cached: Record<string, { price: number; ts?: string }> = {};
    for (const symbol of symbols) {
      if (snapshot?.quotes[symbol]) cached[symbol] = snapshot.quotes[symbol];
    }
    if (Object.keys(cached).length) {
      return Response.json({
        quotes: cached,
        source: "cache",
        fetchedAt: snapshot!.fetchedAt,
        savedAt: snapshot!.fetchedAt,
        ts: snapshot!.fetchedAt,
      });
    }
  }

  return Response.json({ error: "quotes_failed" }, { status: 502 });
}

export async function POST(request: Request) {
  const profile = await profileClient(request);

  let body: {
    action?: string;
    prompt?: string;
    portfolioHash?: string;
    contextId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (
    body.action !== "portfolio_summary" &&
    body.action !== "watchlist_summary"
  ) {
    return Response.json({ error: "unsupported_action" }, { status: 400 });
  }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt || prompt.length > 100_000) {
    return Response.json({ error: "invalid_prompt" }, { status: 400 });
  }

  const started = Date.now();
  const kind = body.action;
  try {
    const result =
      kind === "watchlist_summary"
        ? await createWatchlistAiReport(prompt)
        : await createPortfolioAiReport(prompt);
    let savedId = "unsaved";
    let createdAt = new Date().toISOString();
    if (profile) {
      const { data, error } = await profile.supabase
        .from("tr_api_events")
        .insert({
          user_id: profile.userId,
          provider: "openai",
          kind,
          status: "success",
          model: result.model,
          duration_ms: Date.now() - started,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          captured: {
            promptKind: kind,
            portfolioHash: body.portfolioHash ?? null,
            contextId: body.contextId ?? null,
            report: result.report,
          },
          expires_at: new Date(
            Date.now() + 10 * 365 * 86_400_000
          ).toISOString(),
        })
        .select("id,created_at")
        .single();
      if (!error && data) {
        savedId = data.id;
        createdAt = data.created_at;
      }
    }
    return Response.json({
      saved: {
        id: savedId,
        createdAt,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        report: result.report,
        portfolioHash: body.portfolioHash ?? null,
        contextId: body.contextId ?? null,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "AI summary failed.";
    if (profile) {
      await profile.supabase.from("tr_api_events").insert({
        user_id: profile.userId,
        provider: "openai",
        kind,
        status: "error",
        duration_ms: Date.now() - started,
        captured: { promptKind: kind, contextId: body.contextId ?? null },
        error: message.slice(0, 500),
      });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
