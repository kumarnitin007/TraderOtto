"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Brain, FileText, LoaderCircle, RefreshCw, X } from "lucide-react";
import type { LiveQuote } from "@/hooks/useLiveQuotes";
import { useTickerTechnicals } from "@/hooks/useTickerTechnicals";
import { getSupabaseClient } from "@/lib/supabase";
import { todayISO } from "@/lib/pnl";
import { watchlistPrompt } from "@/lib/watchlistPrompt";
import { PromptPreview } from "@/components/positions/PositionsSummary";
import { AiReportHistory } from "@/components/ai/AiReportHistory";
import type { AiWatchlistReport } from "@/types/positionsAi";
import type { WatchGroup } from "@/types/watchGroup";

type Saved = {
  id: string;
  createdAt: string;
  model: string | null;
  report: AiWatchlistReport;
  portfolioHash: string | null;
  contextId: string | null;
};

function hash(value: string) {
  let result = 5381;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 33) ^ value.charCodeAt(index);
  }
  return (result >>> 0).toString(36);
}

async function authHeaders() {
  const supabase = getSupabaseClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: null };
  return data?.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : null;
}

function inDays(date: string, days: number) {
  const today = new Date(`${todayISO()}T00:00:00Z`).getTime();
  const target = new Date(`${date}T00:00:00Z`).getTime();
  return target >= today && target <= today + days * 86_400_000;
}

export function WatchGroupSummary({
  group,
  quotes,
  readonly,
}: {
  group: WatchGroup;
  quotes: Record<string, LiveQuote>;
  readonly: boolean;
}) {
  const tickers = useMemo(
    () => group.trackers.map((tracker) => tracker.ticker),
    [group.trackers]
  );
  const { technicals, loading: technicalsLoading } =
    useTickerTechnicals(tickers);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [history, setHistory] = useState<Saved[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const prompt = useMemo(
    () => watchlistPrompt(group, quotes, technicals),
    [group, quotes, technicals]
  );
  const currentHash = hash(prompt);

  const local = useMemo(() => {
    const unusual = group.trackers.flatMap((tracker) => {
      const ratio = technicals[tracker.ticker]?.volumeRatio;
      return ratio != null && ratio >= 1.5
        ? [`${tracker.ticker} ${ratio.toFixed(1)}×`]
        : [];
    });
    const earnings = group.trackers
      .filter(
        (tracker) =>
          tracker.earningsDate && inDays(tracker.earningsDate, 30)
      )
      .map((tracker) => `${tracker.ticker} ${tracker.earningsDate}`);
    const breached = group.trackers.flatMap((tracker) => {
      const price = quotes[tracker.ticker]?.price;
      if (!price) return [];
      if (tracker.lowerTrigger != null && price < tracker.lowerTrigger) {
        return [`${tracker.ticker} below $${tracker.lowerTrigger}`];
      }
      if (tracker.upperTrigger != null && price > tracker.upperTrigger) {
        return [`${tracker.ticker} above $${tracker.upperTrigger}`];
      }
      return [];
    });
    const trends = group.trackers.flatMap((tracker) => {
      const price = quotes[tracker.ticker]?.price;
      const stats = technicals[tracker.ticker];
      if (!price || !stats?.sma20 || !stats.sma50) return [];
      if (price > stats.sma20 && price > stats.sma50) {
        return [`${tracker.ticker} above both`];
      }
      if (price < stats.sma20 && price < stats.sma50) {
        return [`${tracker.ticker} below both`];
      }
      return [];
    });
    return { unusual, earnings, breached, trends };
  }, [group.trackers, quotes, technicals]);

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
    void authHeaders()
      .then((headers) =>
        headers
          ? fetch(
              `/api/quotes?ai=history&kind=watchlist_summary&contextId=${encodeURIComponent(group.id)}&limit=10`,
              { headers, cache: "no-store" }
            )
          : null
      )
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload: { items?: Saved[] } | null) => {
        if (!cancelled) {
          const items = payload?.items ?? [];
          setHistory(items);
          setSaved(items[0] ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, open, readonly]);

  async function runAi() {
    if (running || !group.trackers.length) return;
    setRunning(true);
    setError("");
    try {
      const headers = (await authHeaders()) ?? {};
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "watchlist_summary",
          contextId: group.id,
          portfolioHash: currentHash,
          prompt,
        }),
      });
      const payload = (await response.json()) as {
        saved?: Saved;
        error?: string;
      };
      if (!response.ok || !payload.saved) {
        throw new Error(payload.error || "AI research failed.");
      }
      setSaved(payload.saved);
      setHistory((current) => [
        payload.saved!,
        ...current.filter((item) => item.id !== payload.saved!.id),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI research failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
                  Watchlist entry research
                </div>
                <h2 className="mt-1 text-xl font-extrabold">{group.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
                aria-label="Close list summary"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-otto-text-faint">
                What Otto sees
              </h3>
              {technicalsLoading && (
                <div className="mt-2 flex items-center gap-2 text-xs text-otto-text-faint">
                  <LoaderCircle size={13} className="otto-spin" />
                  Loading volume and moving averages…
                </div>
              )}
              <div className="mt-2 space-y-2">
                <LocalLine
                  title="Price alerts crossed"
                  values={local.breached}
                  empty="No watch range crossed."
                />
                <LocalLine
                  title="Unusual volume"
                  values={local.unusual}
                  empty="No ticker above 1.5× its 20-day average."
                />
                <LocalLine
                  title="Earnings within 30 days"
                  values={local.earnings}
                  empty="No cached earnings within 30 days."
                />
                <LocalLine
                  title="Price versus 20/50-day averages"
                  values={local.trends}
                  empty="No ticker clearly above or below both averages."
                />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-otto-text-faint">
                    AI candidate research
                  </h3>
                  <div className="mt-1 text-xs text-otto-text-faint">
                    Ranks entry setups and suggests strategy families to validate.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runAi()}
                  disabled={running || !group.trackers.length || aiReady === false}
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
              {aiReady === false && (
                <div className="mt-3 text-xs text-otto-amber">
                  Add OPENAI_API_KEY to .env (and Vercel env vars), then restart the
                  server. Optional OPENAI_MODEL defaults to gpt-4o-mini.
                </div>
              )}
              {readonly && aiReady !== false && (
                <div className="mt-3 text-xs text-otto-text-faint">
                  Sign in to save ChatGPT reports. You can still run a one-off call.
                </div>
              )}
              {error && <div className="mt-3 text-xs text-otto-red">{error}</div>}
              {loadingSaved && (
                <div className="mt-3 text-xs text-otto-text-faint">
                  Loading saved list research…
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
                    {saved.portfolioHash !== currentHash
                      ? " · list or market data changed since this report"
                      : ""}
                  </div>
                  <WatchlistReport report={saved.report} />
                </div>
              )}

              <PromptPreview
                prompt={prompt}
                copied={copied}
                onCopy={setCopied}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LocalLine({
  title,
  values,
  empty,
}: {
  title: string;
  values: string[];
  empty: string;
}) {
  return (
    <div className="rounded-xl bg-otto-surface px-3 py-2.5">
      <div className="text-xs font-bold">{title}</div>
      <div className="mt-1 text-xs text-otto-text-dim">
        {values.length ? values.join(" · ") : empty}
      </div>
    </div>
  );
}

function WatchlistReport({ report }: { report: AiWatchlistReport }) {
  return (
    <div className="space-y-3 rounded-2xl border border-otto-divider p-3.5">
      <div>
        <div className="text-sm font-extrabold">{report.headline}</div>
        <div className="mt-1 text-xs text-otto-text-dim">
          {report.marketBackdrop}
        </div>
      </div>
      <Section title="Ranked candidates">
        {report.candidates.map((candidate) => (
          <div
            key={candidate.id}
            className="rounded-lg bg-otto-surface p-2.5 text-xs"
          >
            <div className="font-bold">
              #{candidate.rank} {candidate.tkr} · {candidate.setup} ·{" "}
              {candidate.bias}
            </div>
            <div className="mt-1 text-otto-text-dim">{candidate.why}</div>
            <div className="mt-1">
              <span className="font-semibold">Wait for:</span>{" "}
              {candidate.entryTrigger}
            </div>
            <div className="mt-1">
              <span className="font-semibold">Invalid if:</span>{" "}
              {candidate.invalidation}
            </div>
            <div className="mt-1">
              <span className="font-semibold">Structure:</span>{" "}
              {candidate.strategy}
            </div>
            <div className="mt-1">
              <span className="font-semibold">Events:</span>{" "}
              {candidate.events}
            </div>
            {candidate.volumeSignal && (
              <div className="mt-1 text-otto-text-faint">
                Volume: {candidate.volumeSignal}
              </div>
            )}
            {candidate.sourceUrl && (
              <a
                href={candidate.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-otto-green underline"
              >
                catalyst source
              </a>
            )}
          </div>
        ))}
      </Section>
      {report.correlations.length > 0 && (
        <Section title="Duplicate exposure">
          {report.correlations.map((item, index) => (
            <div key={`${item.factor}-${index}`} className="text-xs">
              <span className="font-bold">{item.factor}:</span> {item.note}
              <span className="text-otto-text-faint">
                {" "}
                · {item.ids.length ? item.ids.map((id) => `#${id}`).join(", ") : "no IDs"}
              </span>
            </div>
          ))}
        </Section>
      )}
      {report.avoid.length > 0 && (
        <Section title="Avoid for now">
          {report.avoid.map((item) => (
            <div key={item.id} className="text-xs">
              #{item.id}: {item.reason}
            </div>
          ))}
        </Section>
      )}
      {report.verify.length > 0 && (
        <Section title="Verify before acting">
          {report.verify.map((item, index) => (
            <div key={`${item.claim}-${index}`} className="text-xs">
              <div className="font-bold">{item.claim}</div>
              <div className="mt-0.5 text-otto-text-dim">{item.why}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
