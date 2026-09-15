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
import type {
  AiPortfolioReport,
  SavedAiPortfolioReport,
} from "@/types/positionsAi";

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
  const { groups } = useWatchGroups();
  const openTickers = useMemo(
    () =>
      trades
        .filter((trade) => trade.status === "open")
        .map((trade) => trade.ticker),
    [trades]
  );
  const { technicals, loading: technicalsLoading } =
    useTickerTechnicals(openTickers);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedResponse | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const context = useMemo(() => tickerContextFromGroups(groups), [groups]);
  const prompt = useMemo(
    () => openPositionsPrompt(trades, quotes, marks, context, technicals),
    [trades, quotes, marks, context, technicals]
  );
  const currentHash = promptHash(prompt);
  const local = useMemo(
    () =>
      buildLocalPositionInsights(
        trades,
        quotes,
        marks,
        technicals,
        context
      ),
    [trades, quotes, marks, technicals, context]
  );

  useEffect(() => {
    if (!open || readonly) return;
    let cancelled = false;
    setLoadingSaved(true);
    void authorization()
      .then((headers) =>
        headers
          ? fetch("/api/quotes?ai=latest", {
              headers,
              cache: "no-store",
            })
          : null
      )
      .then((response) => (response?.ok ? response.json() : null))
      .then(
        (payload: { saved?: SavedResponse | null } | null) => {
          if (!cancelled) setSaved(payload?.saved ?? null);
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
    if (readonly || running || !local.openCount) return;
    setRunning(true);
    setError("");
    try {
      const headers = await authorization();
      if (!headers) throw new Error("Sign in to request and save AI insights.");
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
        throw new Error(payload.error || "AI analysis failed.");
      }
      setSaved(payload.saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI analysis failed.");
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
                    AI researched insights
                  </h3>
                  <div className="mt-1 text-xs text-otto-text-faint">
                    Web-grounded catalysts and hidden cross-position risks.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={running || readonly || !local.openCount}
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
                  {running ? "Researching…" : saved ? "Refresh AI" : "Get AI insights"}
                </button>
              </div>

              {readonly && (
                <div className="mt-3 text-xs text-otto-amber">
                  Sign in to request and save AI insights.
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
                  <div className="mb-2 text-[11px] text-otto-text-faint">
                    Saved {new Date(saved.createdAt).toLocaleString()}
                    {stale ? " · positions or market data changed since this report" : ""}
                  </div>
                  <AiReport report={saved.report} />
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(prompt);
                  setCopied(true);
                }}
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-otto-text-faint"
              >
                <Clipboard size={13} />
                {copied ? "Prompt copied" : "Copy research prompt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

function AiReport({ report }: { report: AiPortfolioReport }) {
  return (
    <div className="space-y-3 rounded-2xl border border-otto-divider p-3.5">
      <div>
        <div className="text-sm font-extrabold">{report.headline}</div>
        <div className="mt-1 text-xs text-otto-text-dim">
          Book risk: <span className="font-bold uppercase">{report.bookRisk.level}</span>
          {" · "}
          {report.bookRisk.drivers.join(" · ")}
        </div>
      </div>
      {report.catalysts.length > 0 && (
        <ReportSection title="Catalysts">
          {report.catalysts.map((item, index) => (
            <div key={`${item.date}-${item.event}-${index}`} className="text-xs">
              <span className="font-bold">{item.date}</span> · {item.scope} ·{" "}
              {item.event}
              {item.sourceUrl && (
                <>
                  {" · "}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-otto-green underline"
                  >
                    source
                  </a>
                </>
              )}
            </div>
          ))}
        </ReportSection>
      )}
      {report.positions.length > 0 && (
        <ReportSection title="Position decisions">
          {report.positions.map((item) => (
            <div key={item.id} className="rounded-lg bg-otto-surface p-2.5 text-xs">
              <div className="font-bold">
                {item.tkr} · {item.action.toUpperCase()} · {item.risk} risk
              </div>
              <div className="mt-1 text-otto-text-dim">{item.why}</div>
              {item.volumeSignal && (
                <div className="mt-1 text-otto-text-faint">
                  Volume: {item.volumeSignal}
                </div>
              )}
            </div>
          ))}
        </ReportSection>
      )}
      {report.concentration.length > 0 && (
        <ReportSection title="Hidden concentration">
          {report.concentration.map((item, index) => (
            <div key={`${item.factor}-${index}`} className="text-xs">
              <span className="font-bold">{item.factor}:</span> {item.note}
            </div>
          ))}
        </ReportSection>
      )}
      {report.scenarios.length > 0 && (
        <ReportSection title="Stress scenarios">
          {report.scenarios.map((item, index) => (
            <div key={`${item.name}-${index}`} className="text-xs">
              <span className="font-bold">{item.name}:</span> {item.bookImpact}
            </div>
          ))}
        </ReportSection>
      )}
      {report.blindSpots.length > 0 && (
        <ReportSection title="Blind spots">
          {report.blindSpots.map((item, index) => (
            <div key={`${item}-${index}`} className="text-xs">
              {item}
            </div>
          ))}
        </ReportSection>
      )}
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
