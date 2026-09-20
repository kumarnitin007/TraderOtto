"use client";

import { useState } from "react";
import { Camera, LoaderCircle, X } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import type { LiveQuote } from "@/hooks/useLiveQuotes";
import type { OptionMark } from "@/hooks/useOptionMarks";
import { fmtDate, fmtMoney, realizedPnl } from "@/lib/pnl";
import { parseRobinhoodScreenshot } from "@/lib/robinhoodScreenshot";
import { isDuplicateClosedTrade } from "@/lib/tradeDuplicate";
import type { ClosedTradeImport } from "@/types/trade";
import { PositionsSummary } from "@/components/positions/PositionsSummary";
import { RobinhoodCsvImport } from "@/components/positions/RobinhoodCsvImport";

function toClosedTrade(
  parsed: ReturnType<typeof parseRobinhoodScreenshot>
): ClosedTradeImport | null {
  if (
    !parsed.closed ||
    !parsed.ticker ||
    !parsed.strategy ||
    !parsed.expiry ||
    !parsed.closeDate ||
    !parsed.openDate ||
    !parsed.shortStrike ||
    !parsed.premiumOpen ||
    parsed.premiumClose == null
  ) {
    return null;
  }
  return {
    ticker: parsed.ticker,
    strategy: parsed.strategy,
    contracts: Number(parsed.contracts) || 1,
    expiry: parsed.expiry,
    openDate: parsed.openDate,
    shortStrike: Number(parsed.shortStrike),
    longStrike: parsed.longStrike ? Number(parsed.longStrike) : null,
    callShortStrike: parsed.callShort ? Number(parsed.callShort) : null,
    callLongStrike: parsed.callLong ? Number(parsed.callLong) : null,
    stockPriceOpen: Number(parsed.stockPriceOpen) || 0,
    iv: Number(parsed.iv) || 0,
    delta: Number(parsed.delta) || 0,
    sigma: Number(parsed.sigma) || 0,
    theta: Number(parsed.theta) || 0,
    premiumOpen: Number(parsed.premiumOpen),
    closeDate: parsed.closeDate,
    stockPriceClose: 0,
    premiumClose: Number(parsed.premiumClose),
    closeReason: parsed.closeReason,
    notes: parsed.notes ?? "Imported from Robinhood screenshot.",
  };
}

export function PositionsScreenshotImport({
  quotes,
  marks,
}: {
  quotes: Record<string, LiveQuote>;
  marks: Record<string, OptionMark>;
}) {
  const { trades, addClosedTrade, readonly } = useTrades();
  const [progress, setProgress] = useState<number | null>(null);
  const [candidate, setCandidate] = useState<ClosedTradeImport | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function readScreenshot(file?: File) {
    if (!file) return;
    setError("");
    setCandidate(null);
    setDuplicate(false);
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });
      try {
        const result = await worker.recognize(file);
        const parsed = toClosedTrade(parseRobinhoodScreenshot(result.data.text));
        if (!parsed) {
          setError(
            "Could not recognize a complete closed trade. Use the Robinhood realized profit detail screenshot."
          );
          return;
        }
        setDuplicate(
          trades.some((trade) => isDuplicateClosedTrade(trade, parsed))
        );
        setCandidate(parsed);
      } finally {
        await worker.terminate();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this screenshot.");
    } finally {
      setProgress(null);
    }
  }

  async function save() {
    if (!candidate || saving) return;
    if (readonly) {
      setError("Sign in to save trades to the database.");
      return;
    }
    const duplicateNow = trades.some((trade) =>
      isDuplicateClosedTrade(trade, candidate)
    );
    if (duplicateNow && !duplicate) {
      setDuplicate(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addClosedTrade(candidate, duplicate);
      setCandidate(null);
      setDuplicate(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import this trade.");
    } finally {
      setSaving(false);
    }
  }

  const pnl = candidate
    ? realizedPnl(
        candidate.premiumOpen,
        candidate.premiumClose,
        candidate.contracts,
        candidate.strategy
      )
    : null;

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim ${
            progress != null ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {progress != null ? (
            <LoaderCircle size={14} className="otto-spin" />
          ) : (
            <Camera size={14} />
          )}
          {progress != null ? `Reading ${progress}%` : "Load screenshot"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={progress != null}
            onChange={(event) => {
              void readScreenshot(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <RobinhoodCsvImport />
        <PositionsSummary quotes={quotes} marks={marks} />
        {error && <div className="text-xs font-medium text-otto-red">{error}</div>}
      </div>

      {candidate && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 desk:items-center">
          <div className="w-full max-w-[460px] rounded-t-[28px] bg-otto-bg p-5 shadow-2xl desk:rounded-[24px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-otto-text-faint">
                  Review closed trade
                </div>
                <h2 className="mt-1 text-xl font-extrabold">
                  {candidate.ticker} {candidate.shortStrike}
                  {candidate.longStrike ? `/${candidate.longStrike}` : ""}{" "}
                  {candidate.strategy}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCandidate(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-surface"
                aria-label="Close import review"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-otto-surface p-4 text-sm">
              <Review label="Expiry" value={fmtDate(candidate.expiry)} />
              <Review label="Closed" value={fmtDate(candidate.closeDate)} />
              <Review label="Credit at open" value={fmtMoney(candidate.premiumOpen)} />
              <Review label="Cost at close" value={fmtMoney(candidate.premiumClose)} />
              <Review label="Contracts" value={String(candidate.contracts)} />
              <Review
                label="Realized P/L"
                value={pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`}
              />
            </div>
            <div className="mt-3 text-xs text-otto-text-faint">
              Robinhood does not show the opening date here, so the close date is used for
              journal ordering. Review the recognized values before importing.
            </div>
            {duplicate && (
              <div className="mt-3 rounded-xl bg-otto-amber-soft px-3 py-2.5 text-xs font-semibold text-otto-amber">
                A trade with all the same details is already saved. Import only if this
                was a separate position with identical terms.
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCandidate(null)}
                className="flex-1 rounded-full border border-otto-divider py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="flex-[2] rounded-full bg-otto-green py-3 text-sm font-bold text-black disabled:opacity-60"
              >
                {saving
                  ? "Importing…"
                  : duplicate
                    ? "Import another copy"
                    : "Import closed trade"}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-otto-text-faint">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

