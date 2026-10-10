"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileSpreadsheet,
  LoaderCircle,
  X,
} from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import {
  parseRobinhoodCsv,
  robinhoodCandidateToTradeImport,
  type RobinhoodParseResult,
  type RobinhoodTradeCandidate,
} from "@/lib/robinhoodCsv";
import {
  closedImportCopy,
  matchImportedTradeDuplicates,
  matchTradesForImport,
} from "@/lib/tradeDuplicate";
import { fmtDate, fmtMoney, realizedPnl } from "@/lib/pnl";
import type { Trade, TradeImport, TradeImportResult } from "@/types/trade";

type ReviewItem = {
  candidate: RobinhoodTradeCandidate;
  trade: TradeImport;
  duplicate: boolean;
  openMatch: Trade | null;
  closedCopy: Trade | null;
};

export function RobinhoodCsvImport() {
  const { trades, importTrades, readonly } = useTrades();
  const [result, setResult] = useState<RobinhoodParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Map<string, TradeImportResult>>(new Map());

  const items = useMemo<ReviewItem[]>(() => {
    if (!result) return [];
    const imports = result.candidates.map(robinhoodCandidateToTradeImport);
    const openMatches = matchTradesForImport(trades, imports);
    const duplicates = matchImportedTradeDuplicates(trades, imports);
    return result.candidates.map((candidate, index) => {
      const openMatch = openMatches[index];
      return {
        candidate,
        trade: imports[index],
        openMatch,
        duplicate: !openMatch && Boolean(duplicates[index]),
        closedCopy: openMatch
          ? closedImportCopy(trades, imports[index], openMatch.id)
          : null,
      };
    });
  }, [result, trades]);

  const closing = items.filter((item) => item.openMatch && !item.duplicate);
  const ready = items.filter(
    (item) =>
      item.candidate.confidence === "ready" && !item.duplicate && !item.openMatch
  );
  const duplicates = items.filter((item) => item.duplicate);
  const review = items.filter(
    (item) =>
      item.candidate.confidence === "needs_review" &&
      !item.duplicate &&
      !item.openMatch
  );

  async function readFile(file?: File) {
    if (!file) return;
    setReading(true);
    setError("");
    setSaved(new Map());
    try {
      const parsed = parseRobinhoodCsv(await file.text());
      setResult(parsed);
      setFileName(file.name);
      const imports = parsed.candidates.map(robinhoodCandidateToTradeImport);
      const openMatches = matchTradesForImport(trades, imports);
      const duplicates = matchImportedTradeDuplicates(trades, imports);
      setSelected(
        new Set(
          parsed.candidates
            .filter(
              (candidate, index) =>
                Boolean(openMatches[index]) ||
                (candidate.confidence === "ready" && !duplicates[index])
            )
            .map((candidate) => candidate.sourceFingerprint)
        )
      );
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not read this Robinhood CSV."
      );
    } finally {
      setReading(false);
    }
  }

  function toggle(fingerprint: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fingerprint)) next.delete(fingerprint);
      else next.add(fingerprint);
      return next;
    });
  }

  async function saveSelected() {
    if (readonly) {
      setError("Sign in to import trades.");
      return;
    }
    const chosen = items
      .filter(
        (item) =>
          !item.duplicate &&
          selected.has(item.candidate.sourceFingerprint) &&
          !saved.has(item.candidate.sourceFingerprint)
      )
      .map((item) => item.trade);
    if (!chosen.length) return;
    setSaving(true);
    setError("");
    try {
      const outcomes = await importTrades(chosen);
      setSaved((current) => {
        const next = new Map(current);
        outcomes.forEach((outcome) => next.set(outcome.fingerprint, outcome));
        return next;
      });
      const failures = outcomes.filter((outcome) => outcome.status === "failed");
      if (failures.length) {
        setError(
          `${failures.length} trade${failures.length === 1 ? "" : "s"} failed to import. Expand the rows for details.`
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import trades.");
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = items.filter(
    (item) =>
      !item.duplicate &&
      selected.has(item.candidate.sourceFingerprint) &&
      !saved.has(item.candidate.sourceFingerprint)
  ).length;
  const importedCount = Array.from(saved.values()).filter(
    (outcome) => outcome.status === "imported" || outcome.status === "updated"
  ).length;

  return (
    <>
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim ${
          reading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {reading ? (
          <LoaderCircle size={14} className="otto-spin" />
        ) : (
          <FileSpreadsheet size={14} />
        )}
        {reading ? "Reading CSV…" : "Import Robinhood CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={reading}
          onChange={(event) => {
            void readFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {error && !result && (
        <div className="text-xs font-semibold text-otto-red">{error}</div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 desk:items-center">
          <div className="flex max-h-[94vh] w-full max-w-[820px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
            <div className="flex items-start justify-between gap-3 border-b border-otto-divider p-5">
              <div>
                <div className="text-xs font-semibold text-otto-text-faint">
                  Robinhood CSV dry run
                </div>
                <h2 className="mt-1 text-xl font-extrabold">
                  Review before importing
                </h2>
                <div className="mt-1 text-[11px] text-otto-text-faint">
                  {fileName} · nothing is saved until you approve it
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-surface"
                aria-label="Close CSV review"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid grid-cols-4 gap-2">
                <ReviewStat label="Ready" value={ready.length} tone="good" />
                <ReviewStat label="Already in Otto" value={duplicates.length} />
                <ReviewStat label="Needs review" value={review.length} tone="warn" />
                <ReviewStat
                  label="Unsupported rows"
                  value={result.unsupportedRows.length}
                />
              </div>
              <div className="mt-3 rounded-xl bg-otto-surface px-3 py-2.5 text-[11px] leading-relaxed text-otto-text-faint">
                CSV processing stays in this browser. Assignments use option
                premium P/L only; related stock P/L is excluded. Ambiguous rows
                are not selected automatically.
              </div>
              <details className="mt-3 rounded-xl border border-otto-divider p-3">
                <summary className="cursor-pointer text-xs font-bold">
                  Import summary · {result.summary.openCount} open ·{" "}
                  {result.summary.closedCount} closed
                </summary>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(result.summary.byStrategy).map(
                    ([strategy, count]) => (
                      <span
                        key={strategy}
                        className="rounded-full bg-otto-surface px-2.5 py-1 text-[10.5px] text-otto-text-dim"
                      >
                        {strategy} {count}
                      </span>
                    )
                  )}
                </div>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
                  Monthly realized option P/L
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 desk:grid-cols-3">
                  {Object.entries(result.summary.monthlyRealizedPnl).map(
                    ([month, pnl]) => (
                      <div
                        key={month}
                        className="flex items-center justify-between gap-2 text-[10.5px]"
                      >
                        <span className="text-otto-text-faint">{month}</span>
                        <span
                          className={`font-semibold ${
                            pnl >= 0 ? "text-otto-green" : "text-otto-red"
                          }`}
                        >
                          {signedMoney(pnl)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </details>

              <ReviewGroup
                title="Updates an existing trade"
                subtitle="Matching positions are updated instead of duplicated"
                items={closing}
                selected={selected}
                expanded={expanded}
                saved={saved}
                onToggle={toggle}
                onExpand={setExpanded}
              />
              <ReviewGroup
                title="Ready"
                subtitle="High-confidence reconstructed trades"
                items={ready}
                selected={selected}
                expanded={expanded}
                saved={saved}
                onToggle={toggle}
                onExpand={setExpanded}
              />
              <ReviewGroup
                title="Already in Otto"
                subtitle="Skipped by source fingerprint or business details"
                items={duplicates}
                selected={selected}
                expanded={expanded}
                saved={saved}
                onToggle={toggle}
                onExpand={setExpanded}
                disabled
              />
              <ReviewGroup
                title="Needs review"
                subtitle="Select only after checking the warning and raw activity"
                items={review}
                selected={selected}
                expanded={expanded}
                saved={saved}
                onToggle={toggle}
                onExpand={setExpanded}
              />

              {result.unsupportedRows.length > 0 && (
                <details className="mt-5 rounded-xl border border-otto-divider p-3">
                  <summary className="cursor-pointer text-xs font-bold">
                    Unsupported option rows ({result.unsupportedRows.length})
                  </summary>
                  <div className="mt-2 max-h-40 overflow-y-auto text-[10.5px] text-otto-text-faint">
                    {result.unsupportedRows.map((row) => (
                      <div key={row.rowIndex} className="border-t border-otto-divider py-1.5">
                        Row {row.rowIndex + 1} · {row.transCode} · {row.description}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div className="border-t border-otto-divider p-4">
              {error && (
                <div className="mb-2 text-xs font-semibold text-otto-red">{error}</div>
              )}
              {importedCount > 0 && (
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-otto-green">
                  <Check size={13} /> Saved {importedCount} trade
                  {importedCount === 1 ? "" : "s"}.
                </div>
              )}
              <button
                type="button"
                disabled={saving || selectedCount === 0}
                onClick={() => void saveSelected()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-otto-green py-3 text-sm font-bold text-black disabled:opacity-50"
              >
                {saving && <LoaderCircle size={15} className="otto-spin" />}
                {saving
                  ? "Importing…"
                  : `Import ${selectedCount} selected trade${selectedCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReviewGroup({
  title,
  subtitle,
  items,
  selected,
  expanded,
  saved,
  onToggle,
  onExpand,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  items: ReviewItem[];
  selected: Set<string>;
  expanded: string | null;
  saved: Map<string, TradeImportResult>;
  onToggle: (fingerprint: string) => void;
  onExpand: (fingerprint: string | null) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">
            {title} <span className="text-otto-text-faint">{items.length}</span>
          </h3>
          <div className="mt-0.5 text-[10.5px] text-otto-text-faint">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-otto-divider">
        {items.map((item) => {
          const fingerprint = item.candidate.sourceFingerprint;
          const open = expanded === fingerprint;
          const outcome = saved.get(fingerprint);
          return (
            <div key={fingerprint} className="border-b border-otto-divider last:border-b-0">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  checked={
                    outcome?.status === "imported" ||
                    outcome?.status === "updated" ||
                    (!disabled && selected.has(fingerprint))
                  }
                  disabled={
                    disabled ||
                    outcome?.status === "imported" ||
                    outcome?.status === "updated"
                  }
                  onChange={() => onToggle(fingerprint)}
                  aria-label={`Select ${item.candidate.ticker} ${item.candidate.strategy}`}
                />
                <button
                  type="button"
                  onClick={() => onExpand(open ? null : fingerprint)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="w-12 shrink-0 text-sm font-bold">
                    {item.candidate.ticker}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-otto-text-dim">
                    {item.candidate.strategy} · {strikeLabel(item.candidate)} ·{" "}
                    {item.candidate.status === "closed"
                      ? `closed ${fmtDate(item.candidate.closeDate ?? "")}`
                      : `exp ${fmtDate(item.candidate.expiry)}`}
                  </span>
                  <span className="shrink-0 text-xs font-bold">
                    {item.candidate.status === "closed" ||
                    item.openMatch?.status === "closed"
                      ? signedMoney(displayPnl(item))
                      : fmtMoney(
                          item.candidate.premiumOpen *
                            item.candidate.contracts *
                            100
                        )}
                  </span>
                  {item.candidate.confidence === "needs_review" && (
                    <AlertTriangle size={13} className="shrink-0 text-otto-amber" />
                  )}
                  {(outcome?.status === "imported" || outcome?.status === "updated") && (
                    <Check size={13} className="shrink-0 text-otto-green" />
                  )}
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
              {open && <CandidateDetails item={item} outcome={outcome} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CandidateDetails({
  item,
  outcome,
}: {
  item: ReviewItem;
  outcome?: TradeImportResult;
}) {
  const candidate = item.candidate;
  return (
    <div className="border-t border-otto-divider bg-otto-surface px-3 py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 desk:grid-cols-4">
        <Detail
          label="Opened"
          value={fmtDate(
            item.openMatch?.status === "closed" && candidate.status === "open"
              ? candidate.openDate
              : item.openMatch?.openDate ?? candidate.openDate
          )}
        />
        <Detail label="Expiry" value={fmtDate(candidate.expiry)} />
        <Detail
          label="Open premium"
          value={`${fmtMoney(
            item.openMatch?.status === "closed" && candidate.status === "open"
              ? candidate.premiumOpen
              : item.openMatch?.premiumOpen ?? candidate.premiumOpen
          )} / contract`}
        />
        <Detail
          label="Open fees"
          value={fmtMoney(candidate.commissionOpen)}
        />
        {(candidate.status === "closed" || item.openMatch?.status === "closed") && (
          <>
            <Detail
              label="Closed"
              value={fmtDate(
                candidate.closeDate ?? item.openMatch?.closeDate ?? ""
              )}
            />
            <Detail
              label="Close premium"
              value={`${fmtMoney(
                candidate.premiumClose ?? item.openMatch?.premiumClose ?? 0
              )} / contract`}
            />
            <Detail
              label="Close reason"
              value={candidate.closeReason ?? item.openMatch?.closeReason ?? "closed"}
            />
            <Detail
              label="Close fees"
              value={fmtMoney(
                candidate.status === "closed"
                  ? candidate.commissionClose ?? 0
                  : item.openMatch?.commissionClose ?? 0
              )}
            />
          </>
        )}
      </div>
      {item.openMatch && (
        <div className="mt-3 rounded-lg border border-otto-divider px-3 py-2 text-[10.5px] text-otto-text-dim">
          {item.openMatch.status === "closed" && candidate.status === "open"
            ? `Adds the opening credit from this file to the closed ${item.openMatch.ticker} ${item.openMatch.strategy}.`
            : candidate.status === "closed"
              ? `Closes the existing ${item.openMatch.ticker} ${item.openMatch.strategy} from ${fmtDate(item.openMatch.openDate)}.`
              : `Updates the existing ${item.openMatch.ticker} ${item.openMatch.strategy} from ${fmtDate(item.openMatch.openDate)}.`}
          {candidate.status === "closed"
            ? " Realized profit uses the reconciled Robinhood opening and closing values."
            : item.openMatch.status === "closed"
              ? " The close already saved is kept, and a close-only copy of this position is removed."
              : " Robinhood opening values replace the manually entered transaction values."}
          {item.closedCopy
            ? " The separate copy created by the earlier import will be removed automatically."
            : ""}
        </div>
      )}
      {candidate.issues.length > 0 && (
        <div className="mt-3 rounded-lg bg-otto-amber-soft px-3 py-2 text-[10.5px] text-otto-amber">
          {candidate.issues.map((issue) => issue.message).join(" ")}
        </div>
      )}
      <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        Robinhood activity
      </div>
      <div className="mt-1 text-[10.5px] text-otto-text-faint">
        {candidate.rawEventRefs.map((event) => (
          <div key={`${event.rowIndex}-${event.transCode}`}>
            Row {event.rowIndex + 1} · {event.activityDate} · {event.transCode} ·{" "}
            {event.description}
          </div>
        ))}
      </div>
      {outcome?.status === "failed" && (
        <div className="mt-2 text-xs font-semibold text-otto-red">
          {outcome.error}
        </div>
      )}
    </div>
  );
}

function ReviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-xl bg-otto-surface px-3 py-2.5">
      <div className="text-[9.5px] text-otto-text-faint">{label}</div>
      <div
        className={`mt-0.5 text-lg font-bold ${
          tone === "good"
            ? "text-otto-green"
            : tone === "warn"
              ? "text-otto-amber"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] text-otto-text-faint">{label}</div>
      <div className="mt-0.5 text-xs font-semibold">{value}</div>
    </div>
  );
}

function strikeLabel(candidate: RobinhoodTradeCandidate) {
  if (candidate.strategy === "Iron Condor") {
    return `${candidate.longStrike}/${candidate.shortStrike}P · ${candidate.callShortStrike}/${candidate.callLongStrike}C`;
  }
  if (candidate.longStrike != null) {
    return `${candidate.shortStrike}/${candidate.longStrike}`;
  }
  return String(candidate.shortStrike ?? "—");
}

function displayPnl(item: ReviewItem) {
  if (
    item.openMatch?.status === "closed" &&
    item.candidate.status === "open" &&
    item.openMatch.premiumClose != null
  ) {
    return realizedPnl(
      item.candidate.premiumOpen,
      item.openMatch.premiumClose,
      item.candidate.contracts,
      item.candidate.strategy,
      {
        commissionOpen: item.candidate.commissionOpen,
        commissionClose: item.openMatch.commissionClose,
      }
    );
  }
  if (item.openMatch && item.candidate.premiumClose != null) {
    return realizedPnl(
      item.openMatch.premiumOpen,
      item.candidate.premiumClose,
      item.openMatch.contracts,
      item.openMatch.strategy,
      {
        commissionOpen: item.openMatch.commissionOpen,
        commissionClose: item.candidate.commissionClose,
      }
    );
  }
  return candidatePnl(item.candidate);
}

function candidatePnl(candidate: RobinhoodTradeCandidate) {
  return realizedPnl(
    candidate.premiumOpen,
    candidate.premiumClose ?? 0,
    candidate.contracts,
    candidate.strategy,
    {
      commissionOpen: candidate.commissionOpen,
      commissionClose: candidate.commissionClose,
    }
  );
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${fmtMoney(value)}`;
}
