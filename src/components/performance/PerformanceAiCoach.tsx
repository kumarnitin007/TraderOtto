"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, FileText, LoaderCircle, RefreshCw, X } from "lucide-react";
import { PromptPreview } from "@/components/positions/PositionsSummary";
import { AiPerformanceReportView } from "@/components/performance/AiPerformanceReportView";
import { AiReportHistory } from "@/components/ai/AiReportHistory";
import { useTrades } from "@/hooks/useTrades";
import { useScreenOption } from "@/hooks/useScreenOption";
import { fmtMoney } from "@/lib/pnl";
import {
  localPerformanceSnapshot,
  PERFORMANCE_AI_MODES,
  PERFORMANCE_AI_RANGES,
  performanceAiPrompt,
  performanceRangeLabel,
  performanceTradesInRange,
} from "@/lib/performancePrompt";
import { getSupabaseClient } from "@/lib/supabase";
import { performanceReportDelta } from "@/lib/aiReportDelta";
import type {
  PerformanceAiMode,
  SavedAiPerformanceReport,
} from "@/types/performanceAi";

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

export function PerformanceAiCoach() {
  const { trades, readonly } = useTrades();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useScreenOption("pnlRange");
  const [mode, setMode] = useState<PerformanceAiMode>("performance_review");
  const [saved, setSaved] = useState<SavedAiPerformanceReport | null>(null);
  const [history, setHistory] = useState<SavedAiPerformanceReport[]>([]);
  const [changes, setChanges] = useState<string[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const selected = useMemo(
    () => performanceTradesInRange(trades, range),
    [trades, range]
  );
  const snapshot = useMemo(
    () => localPerformanceSnapshot(selected),
    [selected]
  );
  const prompt = useMemo(
    () => performanceAiPrompt(trades, range, mode),
    [trades, range, mode]
  );
  const currentHash = promptHash(prompt);

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
    setSaved(null);
    setHistory([]);
    setChanges([]);
    setLoadingSaved(true);
    setError("");
    void authorization()
      .then((headers) =>
        headers
          ? fetch(
              `/api/quotes?ai=history&kind=${mode}&contextId=${encodeURIComponent(range)}&limit=10`,
              { headers, cache: "no-store" }
            )
          : null
      )
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload: { items?: SavedAiPerformanceReport[] } | null) => {
        if (!cancelled) {
          const items = payload?.items ?? [];
          setHistory(items);
          setSaved(items[0] ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the saved AI report.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, open, range, readonly]);

  async function runAi() {
    if (running || !snapshot.tradeCount) return;
    setRunning(true);
    setError("");
    try {
      const headers = (await authorization()) ?? {};
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          prompt,
          portfolioHash: currentHash,
          contextId: range,
        }),
      });
      const payload = (await response.json()) as {
        saved?: SavedAiPerformanceReport;
        error?: string;
      };
      if (!response.ok || !payload.saved) {
        throw new Error(payload.error || "Performance analysis failed.");
      }
      const previous = saved;
      setSaved(payload.saved);
      setHistory((current) => [
        payload.saved!,
        ...current.filter((item) => item.id !== payload.saved!.id),
      ]);
      setChanges(
        previous
          ? performanceReportDelta(previous.report, payload.saved.report)
          : []
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Performance analysis failed."
      );
    } finally {
      setRunning(false);
    }
  }

  const activeMode =
    PERFORMANCE_AI_MODES.find((option) => option.value === mode) ??
    PERFORMANCE_AI_MODES[0];
  const stale = Boolean(saved && saved.portfolioHash !== currentHash);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-otto-green px-3.5 py-2 text-xs font-bold text-black"
      >
        <Brain size={14} />
        AI performance coach
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 desk:items-center">
          <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
            <div className="flex items-start justify-between gap-3 border-b border-otto-divider p-5">
              <div>
                <div className="text-xs font-semibold text-otto-text-faint">
                  Closed-trade journal
                </div>
                <h2 className="mt-1 text-xl font-extrabold">
                  AI performance coach
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-surface"
                aria-label="Close AI performance coach"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
                Performance period
              </label>
              <select
                value={range}
                onChange={(event) => setRange(event.target.value as typeof range)}
                className="mt-2 w-full rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-sm font-semibold"
              >
                {PERFORMANCE_AI_RANGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] text-otto-text-faint">
                Default: Last 12 months · only closed trades are analyzed
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Metric label="Trades" value={String(snapshot.tradeCount)} />
                <Metric
                  label="Realized"
                  value={fmtMoney(snapshot.realized)}
                  tone={snapshot.realized >= 0 ? "good" : "bad"}
                />
                <Metric
                  label="Win rate"
                  value={
                    snapshot.winRate == null
                      ? "—"
                      : `${Math.round(snapshot.winRate * 100)}%`
                  }
                />
              </div>

              <h3 className="mt-6 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
                What should AI answer?
              </h3>
              <div className="mt-2 grid gap-2 desk:grid-cols-3">
                {PERFORMANCE_AI_MODES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={`rounded-xl border p-3 text-left ${
                      mode === option.value
                        ? "border-otto-green bg-otto-green-soft"
                        : "border-otto-divider bg-otto-surface"
                    }`}
                  >
                    <div className="text-xs font-bold">{option.label}</div>
                    <div className="mt-1 text-[10.5px] leading-snug text-otto-text-dim">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-otto-text-faint">
                  {snapshot.tradeCount
                    ? `${activeMode.label} · ${performanceRangeLabel(range)}`
                    : `No closed trades in ${performanceRangeLabel(range).toLowerCase()}.`}
                </div>
                <button
                  type="button"
                  onClick={() => void runAi()}
                  disabled={
                    running || !snapshot.tradeCount || aiReady === false
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-otto-green px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50"
                >
                  {running ? (
                    <LoaderCircle size={14} className="otto-spin" />
                  ) : saved ? (
                    <RefreshCw size={14} />
                  ) : (
                    <FileText size={14} />
                  )}
                  {running
                    ? "Analyzing…"
                    : saved
                      ? "Refresh this answer"
                      : "Ask AI"}
                </button>
              </div>

              {aiReady === false && (
                <div className="mt-3 text-xs text-otto-amber">
                  OpenAI is not configured for this deployment.
                </div>
              )}
              {readonly && aiReady !== false && (
                <div className="mt-3 text-xs text-otto-text-faint">
                  Sign in to save reports. A one-off report can still run.
                </div>
              )}
              {error && <div className="mt-3 text-xs text-otto-red">{error}</div>}
              {loadingSaved && (
                <div className="mt-3 flex items-center gap-2 text-xs text-otto-text-faint">
                  <LoaderCircle size={13} className="otto-spin" />
                  Loading the saved answer…
                </div>
              )}

              {saved && (
                <div className="mt-5">
                  <AiReportHistory
                    items={history}
                    selectedId={saved.id}
                    onSelect={(item) => {
                      setSaved(item);
                      setChanges([]);
                    }}
                  />
                  {changes.length > 0 && (
                    <div className="mb-3 rounded-xl bg-otto-green-soft p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-otto-green">
                        What changed since the prior answer
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-otto-text-dim">
                        {changes.map((change) => (
                          <li key={change}>• {change}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mb-2 text-[11px] text-otto-text-faint">
                    Saved {new Date(saved.createdAt).toLocaleString()}
                    {stale ? " · trades changed since this report" : ""}
                  </div>
                  <AiPerformanceReportView report={saved.report} />
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

function Metric({
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
