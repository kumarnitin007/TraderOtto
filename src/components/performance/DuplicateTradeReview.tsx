"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, X } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { fmtDate, fmtMoney, tradePnl } from "@/lib/pnl";
import {
  isRobinhoodCsvTrade,
  potentialDuplicateTrades,
  type PotentialDuplicateGroup,
} from "@/lib/tradePotentialDuplicate";
import type { Trade } from "@/types/trade";

const DISMISSED_KEY = "trader-otto:dismissed-potential-duplicates";

function token(group: PotentialDuplicateGroup) {
  return `${group.key}::${group.trades.map((trade) => trade.id).sort().join(",")}`;
}

export function DuplicateTradeReview() {
  const { trades, deleteTrade, readonly } = useTrades();
  const groups = useMemo(() => potentialDuplicateTrades(trades), [trades]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(DISMISSED_KEY) ?? "[]"
      ) as unknown;
      if (Array.isArray(stored)) {
        setDismissed(
          new Set(stored.filter((item): item is string => typeof item === "string"))
        );
      }
    } catch {
      setDismissed(new Set());
    }
  }, []);

  const visible = useMemo(
    () => groups.filter((group) => !dismissed.has(token(group))),
    [dismissed, groups]
  );

  useEffect(() => {
    setSelected((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of visible) {
        if (!next[group.key] && group.recommendedId) {
          next[group.key] = group.recommendedId;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [visible]);

  if (!visible.length) return null;

  function keepBoth(group: PotentialDuplicateGroup) {
    const next = new Set(dismissed);
    next.add(token(group));
    setDismissed(next);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    setConfirming(null);
  }

  async function resolve(group: PotentialDuplicateGroup) {
    const keepId = selected[group.key];
    if (!keepId || readonly) return;
    if (confirming !== group.key) {
      setConfirming(group.key);
      return;
    }
    setSaving(group.key);
    setError("");
    try {
      for (const trade of group.trades) {
        if (trade.id !== keepId) await deleteTrade(trade.id);
      }
      setConfirming(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not remove the duplicate trade."
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-otto-amber/40 bg-otto-amber-soft px-3.5 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-otto-amber" />
          <span>
            <span className="block text-xs font-bold">
              {visible.length} potential duplicate
              {visible.length === 1 ? "" : " groups"}
            </span>
            <span className="mt-0.5 block text-[10.5px] text-otto-text-dim">
              Review similar broker and manually logged trades.
            </span>
          </span>
        </span>
        <span className="text-xs font-bold text-otto-amber">Review</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 desk:items-center">
          <div className="flex max-h-[94vh] w-full max-w-[720px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
            <div className="flex items-start justify-between border-b border-otto-divider p-5">
              <div>
                <div className="text-xs font-semibold text-otto-text-faint">
                  Journal cleanup
                </div>
                <h2 className="mt-1 text-xl font-extrabold">
                  Potential duplicates
                </h2>
                <p className="mt-1 text-xs text-otto-text-faint">
                  Direct Robinhood CSV activity is recommended when exactly one
                  broker record matches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
                aria-label="Close duplicate review"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              {error && (
                <div className="mb-3 rounded-xl bg-otto-red-soft px-3 py-2 text-xs text-otto-red">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                {visible.map((group) => (
                  <DuplicateGroup
                    key={token(group)}
                    group={group}
                    selectedId={selected[group.key] ?? ""}
                    onSelect={(id) =>
                      setSelected((current) => ({
                        ...current,
                        [group.key]: id,
                      }))
                    }
                    onKeepBoth={() => keepBoth(group)}
                    onResolve={() => void resolve(group)}
                    confirming={confirming === group.key}
                    saving={saving === group.key}
                    readonly={readonly}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DuplicateGroup({
  group,
  selectedId,
  onSelect,
  onKeepBoth,
  onResolve,
  confirming,
  saving,
  readonly,
}: {
  group: PotentialDuplicateGroup;
  selectedId: string;
  onSelect: (id: string) => void;
  onKeepBoth: () => void;
  onResolve: () => void;
  confirming: boolean;
  saving: boolean;
  readonly: boolean;
}) {
  const first = group.trades[0];
  return (
    <section className="rounded-2xl border border-otto-divider p-3.5">
      <div className="text-sm font-bold">
        {first.ticker} · {first.strategy}
      </div>
      <div className="mt-0.5 text-[10.5px] text-otto-text-faint">
        {group.reason}
      </div>
      <div className="mt-3 space-y-2">
        {group.trades.map((trade) => (
          <TradeChoice
            key={trade.id}
            trade={trade}
            selected={trade.id === selectedId}
            recommended={trade.id === group.recommendedId}
            onSelect={() => onSelect(trade.id)}
          />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onKeepBoth}
          disabled={saving}
          className="flex-1 rounded-full border border-otto-divider py-2 text-xs font-semibold text-otto-text-dim"
        >
          Keep both
        </button>
        <button
          type="button"
          onClick={onResolve}
          disabled={!selectedId || saving || readonly}
          className={`flex-[2] rounded-full py-2 text-xs font-bold ${
            confirming
              ? "bg-otto-red text-white"
              : "bg-otto-text text-otto-bg"
          } disabled:opacity-50`}
        >
          {saving ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle size={13} className="otto-spin" />
              Removing duplicate…
            </span>
          ) : confirming ? (
            "Confirm: remove the other record"
          ) : (
            "Keep selected record"
          )}
        </button>
      </div>
    </section>
  );
}

function TradeChoice({
  trade,
  selected,
  recommended,
  onSelect,
}: {
  trade: Trade;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const pnl = tradePnl(trade);
  const source = isRobinhoodCsvTrade(trade)
    ? "Robinhood CSV"
    : trade.notes.toLowerCase().includes("robinhood screenshot")
      ? "Robinhood screenshot"
      : "Manual journal";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left ${
        selected
          ? "border-otto-green bg-otto-green-soft"
          : "border-otto-divider"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            {source}
            {recommended && (
              <span className="rounded-full bg-otto-green px-1.5 py-0.5 text-[9px] text-black">
                Recommended
              </span>
            )}
          </div>
          <div className="mt-1 text-[10.5px] text-otto-text-faint">
            Opened {fmtDate(trade.openDate)} · closed{" "}
            {fmtDate(trade.closeDate ?? trade.openDate)} · exp{" "}
            {fmtDate(trade.expiry)}
          </div>
          <div className="mt-0.5 text-[10.5px] text-otto-text-faint">
            Open {fmtMoney(trade.premiumOpen)} · close{" "}
            {fmtMoney(trade.premiumClose ?? 0)} · fees{" "}
            {fmtMoney(
              (trade.commissionOpen ?? 0) + (trade.commissionClose ?? 0)
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`text-sm font-bold ${
              (pnl ?? 0) >= 0 ? "text-otto-green" : "text-otto-red"
            }`}
          >
            {(pnl ?? 0) >= 0 ? "+" : ""}
            {fmtMoney(pnl ?? 0)}
          </div>
          <div className="mt-1 flex justify-end">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                selected
                  ? "border-otto-green bg-otto-green text-black"
                  : "border-otto-divider"
              }`}
            >
              {selected && <Check size={11} />}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
