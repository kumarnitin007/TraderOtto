"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Clipboard,
  FileText,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useScreenOption } from "@/hooks/useScreenOption";
import type { LiveQuote } from "@/hooks/useLiveQuotes";
import type { OptionMark } from "@/hooks/useOptionMarks";
import { useTickerTechnicals } from "@/hooks/useTickerTechnicals";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { getSupabaseClient } from "@/lib/supabase";
import { fmtMoney } from "@/lib/pnl";
import { buildLocalPositionInsights } from "@/lib/positionsAnalysis";
import {
  openPositionsPrompt,
  tickerContextFromGroups,
} from "@/lib/positionsPrompt";
import { AiPortfolioReportViews } from "@/components/positions/AiPortfolioReportViews";
import { AiReportHistory } from "@/components/ai/AiReportHistory";
import type { SavedAiPortfolioReport } from "@/types/positionsAi";
import { tradesInScope } from "@/lib/tradeScope";

type SavedResponse = SavedAiPortfolioReport & { portfolioHash: string | null };

function promptHash(prompt: string) {
  let hash = 5381;
  for (let index = 0; index < prompt.length; index += 1) {
    hash = (hash * 33) ^ prompt.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

async function authorization() {
  const supabase = getSupabaseClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: null };
  return data?.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : null;
}

export function PositionsSummary({
  quotes,
  marks,
}: {
  quotes: Record<string, LiveQuote>;
  marks: Record<string, OptionMark>;
}) {
  const { trades, readonly } = useTrades();
  const [tradeScope] = useScreenOption("tradeScope");
  const scopedTrades = useMemo(
    () => tradesInScope(trades, tradeScope),
    [tradeScope, trades]
  );
  const { groups } = useWatchGroups();
  const openTickers = useMemo(
    () =>
      scopedTrades
        .filter((trade) => trade.status === "open")
        .map((trade) => trade.ticker),
    [scopedTrades]
  );
  const { technicals, loading: technicalsLoading } =
    useTickerTechnicals(openTickers);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedResponse | null>(null);
  const [history, setHistory] = useState<SavedResponse[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const context = useMemo(() => tickerContextFromGroups(groups), [groups]);
  const prompt = useMemo(
    () => openPositionsPrompt(scopedTrades, quotes, marks, context, technicals),
    [scopedTrades, quotes, marks, context, technicals]
  );
  const currentHash = promptHash(prompt);
  const local = useMemo(
    () =>
      buildLocalPositionInsights(
        scopedTrades,
        quotes,
        marks,
        technicals,
        context
      ),
    [scopedTrades, quotes, marks, technicals, context]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/quotes?ai=status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { configured?: boolean } | null) => {
        if (!cancelled) setAiReady(Boolean(payload?.configured));
      })
      .catch(() => {
        if (!cancelled) setAiReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || readonly) return;
    let cancelled = false;
    setLoadingSaved(true);
    void authorization()
      .then((headers) =>
        headers
          ? fetch("/api/quotes?ai=history&kind=portfolio_summary&limit=10", {
              headers,
              cache: "no-store",
            })
          : null
      )
      .then((response) => (response?.ok ? response.json() : null))
      .then(
        (payload: { items?: SavedResponse[] } | null) => {
          if (!cancelled) {
            const items = payload?.items ?? [];
            setHistory(items);
            setSaved(items[0] ?? null);
          }
        }
      )
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, readonly]);

  async function runAi() {
    if (running || !local.openCount) return;
    setRunning(true);
    setError("");
    try {
      const headers = (await authorization()) ?? {};
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "portfolio_summary",
          prompt,
          portfolioHash: currentHash,
        }),
      });
      const payload = (await response.json()) as {
        saved?: SavedResponse;
        error?: string;
      };
      if (!response.ok || !payload.saved) {
        throw new Error(payload.error || "Otto could not finish the analysis.");
      }
      setSaved(payload.saved);
      setHistory((current) => [
        payload.saved!,
        ...current.filter((item) => item.id !== payload.saved!.id),
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Otto could not finish the analysis."
      );
    } finally {
      setRunning(false);
    }
  }

  const stale = Boolean(saved && saved.portfolioHash !== currentHash);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
      >
        <FileText size={14} />
        Summary
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 desk:items-center">
          <div className="flex max-h-[92vh] w-full max-w-[680px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
            <div className="flex items-start justify-between gap-3 border-b border-otto-divider p-5">
              <div>
                <div className="text-xs font-semibold text-otto-text-faint">
                  Open positions
                </div>
                <h2 className="mt-1 text-xl font-extrabold">Portfolio summary</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-surface"
                aria-label="Close positions summary"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Open" value={String(local.openCount)} />
                <Stat label="Marked" value={String(local.markedCount)} />
                <Stat
                  label="Unrealized"
                  value={`${local.totalPnl >= 0 ? "+" : ""}${fmtMoney(local.totalPnl)}`}
                  tone={local.totalPnl >= 0 ? "good" : "bad"}
                />
              </div>

              <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-otto-text-faint">
                What Otto sees
              </h3>
              {technicalsLoading && (
                <div className="mt-3 flex items-center gap-2 text-xs text-otto-text-faint">
                  <LoaderCircle size={13} className="otto-spin" />
                  Loading volume and moving averages…
                </div>
              )}
              <div className="mt-2 space-y-2">
                {local.insights.length ? (
                  local.insights.map((insight) => (
                    <div
                      key={`${insight.title}-${insight.detail}`}
                      className={`rounded-xl px-3 py-2.5 ${
                        insight.tone === "danger"
                          ? "bg-otto-red-soft"
                          : insight.tone === "warning"
                            ? "bg-otto-amber-soft"
                            : "bg-otto-surface"
                      }`}
                    >
                      <div className="text-sm font-bold">{insight.title}</div>
                      <div className="mt-0.5 text-xs text-otto-text-dim">
                        {insight.detail}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-otto-surface px-3 py-3 text-sm text-otto-text-dim">
                    No immediate expiry, earnings, volume, trend, or strike-proximity
                    flags.
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-otto-text-faint">
                    Otto research
                  </h3>
                  <div className="mt-1 text-xs text-otto-text-faint">
                    Web-grounded catalysts and hidden cross-position risks.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={running || !local.openCount || aiReady === false}
                  onClick={() => void runAi()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-otto-green px-3.5 py-2 text-xs font-bold text-black disabled:opacity-50"
                >
                  {running ? (
                    <LoaderCircle size={14} className="otto-spin" />
                  ) : saved ? (
                    <RefreshCw size={14} />
                  ) : (
                    <Brain size={14} />
                  )}
                  {running
                    ? "Otto is thinking…"
                    : saved
                      ? "Ask Otto again"
                      : "Ask Otto"}
                </button>
              </div>

              {aiReady === false && (
                <div className="mt-3 text-xs text-otto-amber">
                  Add OPENAI_API_KEY to .env (and Vercel env vars), then restart the
                  server. Optional OPENAI_MODEL defaults to gpt-4o-mini.
                </div>
              )}
              {readonly && aiReady !== false && (
                <div className="mt-3 text-xs text-otto-text-faint">
                  Sign in to save Otto reports. You can still run a one-off call.
                </div>
              )}
              {error && <div className="mt-3 text-xs text-otto-red">{error}</div>}
              {loadingSaved && (
                <div className="mt-3 flex items-center gap-2 text-xs text-otto-text-faint">
                  <LoaderCircle size={13} className="otto-spin" />
                  Loading your saved report…
                </div>
              )}
              {saved && (
                <div className="mt-3">
                  <AiReportHistory
                    items={history}
                    selectedId={saved.id}
                    onSelect={setSaved}
                  />
                  <div className="mb-2 text-[11px] text-otto-text-faint">
                    Saved {new Date(saved.createdAt).toLocaleString()}
                    {stale ? " · positions or market data changed since this report" : ""}
                  </div>
                  <AiPortfolioReportViews report={saved.report} />
                </div>
              )}

              <PromptPreview prompt={prompt} copied={copied} onCopy={setCopied} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Keep the copy-and-paste path available until the AI call is fully trusted. */
export function PromptPreview({
  prompt,
  copied,
  onCopy,
}: {
  prompt: string;
  copied: boolean;
  onCopy: (copied: boolean) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mt-6 border-t border-otto-divider pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-otto-text-faint">
            Manual prompt
          </h3>
          <div className="mt-1 text-xs text-otto-text-faint">
            Paste into ChatGPT to compare against the built-in call.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          className="shrink-0 rounded-full border border-otto-divider px-3 py-1.5 text-xs font-semibold text-otto-text-dim"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {shown && (
        <>
          <textarea
            readOnly
            value={prompt}
            rows={14}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-3 w-full resize-none font-mono text-[11px] leading-relaxed"
            aria-label="Research prompt text"
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              onCopy(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-otto-green px-3.5 py-2 text-xs font-bold text-black"
          >
            <Clipboard size={13} />
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-xl bg-otto-surface p-3">
      <div className="text-[10px] text-otto-text-faint">{label}</div>
      <div
        className={`mt-1 truncate text-sm font-extrabold ${
          tone === "good"
            ? "text-otto-green"
            : tone === "bad"
              ? "text-otto-red"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
