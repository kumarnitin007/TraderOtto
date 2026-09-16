"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2 } from "lucide-react";
import type { ClosePayload, CloseReason, Trade } from "@/types/trade";
import type { LiveQuote } from "@/hooks/useLiveQuotes";
import type { OptionMark } from "@/hooks/useOptionMarks";
import {
  fmtDate,
  fmtMoney,
  markPnl,
  premiumDirection,
  tickerAvatarColor,
  tradePnl,
  todayISO,
} from "@/lib/pnl";
import { isDebitStrategy } from "@/types/trade";
import { positionAlert } from "@/lib/premiumPace";
import { Sparkline } from "@/components/ui/Sparkline";
import { QuickQuoteButton } from "@/components/ui/QuickQuoteButton";
import { RealizedPnlPreview } from "@/components/ui/RealizedPnlPreview";
import { PaceBadge } from "@/components/positions/PaceBadge";
import { assignmentCapital } from "@/lib/roi";
import { AI_TRADE_DRAFT_KEY } from "@/lib/aiTradeDraft";

export function TradeRow({
  t,
  open,
  onToggle,
  closing,
  onStartClose,
  onCancelClose,
  onConfirmClose,
  onDelete,
  onTickerClick,
  live,
  optionMark,
}: {
  t: Trade;
  open: boolean;
  onToggle: () => void;
  closing: boolean;
  onStartClose: () => void;
  onCancelClose: () => void;
  onConfirmClose: (payload: ClosePayload) => Promise<void>;
  onDelete: () => void;
  onTickerClick: () => void;
  live?: LiveQuote;
  optionMark?: OptionMark;
}) {
  const router = useRouter();
  const pnl = tradePnl(t);
  const livePrice = live?.price ?? t.stockPriceOpen ?? t.stockPriceClose ?? 0;
  const movedUp = livePrice >= (t.stockPriceOpen || 0);
  const debit = isDebitStrategy(t.strategy);
  const openingPremium =
    premiumDirection(t.strategy) * Math.abs(t.premiumOpen) * t.contracts * 100;
  const currentMark = optionMark?.mark;
  const unrealizedPnl = currentMark == null ? null : markPnl(t, currentMark);
  const pace = positionAlert(t, currentMark);
  const assignmentCash = assignmentCapital(t);
  const [closeDate, setCloseDate] = useState(t.closeDate || todayISO());
  const [stockPriceClose, setStockPriceClose] = useState(
    t.stockPriceClose != null ? String(t.stockPriceClose) : ""
  );
  const [premiumClose, setPremiumClose] = useState(
    t.premiumClose != null ? String(t.premiumClose) : ""
  );
  const [commissionClose, setCommissionClose] = useState(
    String(t.commissionClose || "")
  );
  const [closeReason, setCloseReason] = useState<CloseReason>(
    t.closeReason ?? "closed"
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) setConfirmDelete(false);
  }, [open]);

  const strikesLabel =
    t.strategy === "Iron Condor"
      ? `${t.longStrike}/${t.shortStrike}P · ${t.callShortStrike}/${t.callLongStrike}C`
      : t.longStrike
        ? `${t.shortStrike} / ${t.longStrike}`
        : `${t.shortStrike}`;

  const avatarBg = tickerAvatarColor(t.ticker);

  return (
    <div className="border-b border-otto-divider">
      <button
        type="button"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[data-ticker-link]")) {
            onTickerClick();
            return;
          }
          onToggle();
        }}
        className="flex w-full items-center gap-2.5 bg-transparent px-1 py-[13px] text-left desk:gap-3"
      >
        <div
          data-ticker-link
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
          style={{ background: avatarBg }}
          title={`Open ${t.ticker} market details`}
        >
          {t.ticker.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-[7px]">
            <span
              data-ticker-link
              className="shrink-0 text-[15px] font-bold underline decoration-transparent underline-offset-4 hover:decoration-current"
              title={`Open ${t.ticker} market details`}
            >
              {t.ticker}
            </span>
            {pace && <PaceBadge signal={pace} />}
            <span className="truncate text-xs text-otto-text-faint">{t.strategy}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-otto-text-faint">
            {strikesLabel} · exp {fmtDate(t.expiry)} · {t.contracts}x
          </div>
        </div>
        {t.status === "open" && (
          <div className="mr-3.5 hidden desk:block">
            <Sparkline ticker={t.ticker} base={livePrice} positive={movedUp} />
          </div>
        )}
        <div className="shrink-0 text-right">
          {t.status === "open" ? (
            <>
              {unrealizedPnl != null ? (
                <>
                  <div
                    className={`text-[14.5px] font-bold ${
                      unrealizedPnl >= 0 ? "text-otto-green" : "text-otto-red"
                    }`}
                  >
                    {unrealizedPnl >= 0 ? "+" : ""}
                    {fmtMoney(unrealizedPnl)}
                  </div>
                  <div className="mt-0.5 whitespace-nowrap text-[11.5px] text-otto-text-faint">
                    <span className="desk:hidden">${currentMark!.toFixed(2)} now</span>
                    <span className="hidden desk:inline">
                      ${currentMark!.toFixed(2)} current · ${Math.abs(t.premiumOpen).toFixed(2)} open
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={`text-[14.5px] font-bold ${
                      openingPremium >= 0 ? "text-otto-green" : "text-otto-red"
                    }`}
                  >
                    {openingPremium >= 0 ? "+" : ""}
                    {fmtMoney(openingPremium)}
                  </div>
                  <div className="mt-0.5 whitespace-nowrap text-[11.5px] text-otto-text-faint">
                    <span className="desk:hidden">no live mark</span>
                    <span className="hidden desk:inline">
                      opening {debit ? "debit" : "credit"} · live mark unavailable
                    </span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div
                className={`text-[14.5px] font-bold ${pnl != null && pnl >= 0 ? "text-otto-green" : "text-otto-red"}`}
              >
                {pnl != null && pnl >= 0 ? "+" : ""}
                {fmtMoney(pnl ?? 0)}
              </div>
              <div className="mt-0.5 whitespace-nowrap text-[11.5px] text-otto-text-faint">
                closed {t.closeDate ? fmtDate(t.closeDate) : ""}
              </div>
            </>
          )}
        </div>
        <ChevronDown
          size={15}
          className={`shrink-0 text-otto-text-faint transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-1 pb-[18px] pl-3 pt-0.5 desk:pl-[50px]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 pt-2.5 desk:grid-cols-4 desk:gap-3.5">
            <GreekReadout
              label={debit ? "Premium paid" : "Premium collected"}
              value={`${openingPremium >= 0 ? "+" : ""}${fmtMoney(openingPremium)}`}
              accent={
                openingPremium >= 0
                  ? "rgb(var(--otto-green))"
                  : "rgb(var(--otto-red))"
              }
            />
            <GreekReadout
              label="Per contract"
              value={fmtMoney(Math.abs(t.premiumOpen))}
            />
            {optionMark && (
              <GreekReadout
                label="Current spread"
                value={`$${optionMark.mark.toFixed(2)}`}
              />
            )}
            {unrealizedPnl != null && (
              <GreekReadout
                label="Unrealized P/L"
                value={`${unrealizedPnl >= 0 ? "+" : ""}${fmtMoney(unrealizedPnl)}`}
                accent={
                  unrealizedPnl >= 0
                    ? "rgb(var(--otto-green))"
                    : "rgb(var(--otto-red))"
                }
              />
            )}
            <GreekReadout label="Open px" value={`$${Number(t.stockPriceOpen).toFixed(2)}`} />
            <GreekReadout label="IV" value={fmtIv(optionMark?.iv, t.iv)} />
            <GreekReadout label="Delta" value={fmtGreek(optionMark?.delta, t.delta)} />
            <GreekReadout label="Theta" value={fmtGreek(optionMark?.theta, t.theta)} />
            <GreekReadout
              label={optionMark?.vega != null ? "Vega" : "Sigma"}
              value={fmtGreek(optionMark?.vega, t.sigma)}
            />
            <GreekReadout label="Opened" value={fmtDate(t.openDate)} />
            {assignmentCash != null && (
              <GreekReadout
                label="Assignment cash"
                value={fmtMoney(assignmentCash)}
                accent="rgb(var(--otto-amber))"
              />
            )}
            {t.status === "open" && (
              <GreekReadout
                label="Live px"
                value={`$${livePrice.toFixed(2)}`}
                accent={movedUp ? "rgb(var(--otto-green))" : "rgb(var(--otto-red))"}
              />
            )}
            {t.status === "closed" && t.stockPriceClose != null && (
              <GreekReadout label="Closed px" value={`$${Number(t.stockPriceClose).toFixed(2)}`} />
            )}
            {t.status === "closed" && t.premiumClose != null && (
              <GreekReadout
                label={debit ? "Credit received" : "Debit paid"}
                value={t.premiumClose}
              />
            )}
            {(t.commissionOpen || t.commissionClose) && (
              <GreekReadout
                label="Total fees"
                value={fmtMoney(
                  (t.commissionOpen ?? 0) + (t.commissionClose ?? 0)
                )}
              />
            )}
            {t.status === "closed" && (
              <GreekReadout
                label="Close reason"
                value={t.closeReason ?? "closed"}
              />
            )}
          </div>

          {!closing && (
            <div className="mt-4 flex gap-2">
              {t.status === "open" && (
                <button
                  type="button"
                  onClick={onStartClose}
                  className="flex-[2] rounded-full border border-otto-divider bg-transparent py-[11px] text-[13.5px] font-semibold text-otto-text"
                >
                  Close position
                </button>
              )}
              <button
                type="button"
                onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-[11px] text-[13.5px] font-semibold ${
                  confirmDelete
                    ? "border border-otto-red bg-otto-red-soft text-otto-red"
                    : "border border-otto-divider bg-transparent text-otto-text-dim"
                }`}
              >
                <Trash2 size={14} />
                {confirmDelete ? "Tap to confirm" : "Delete"}
              </button>
            </div>
          )}

          {t.status === "open" && closing && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
                    Close date
                  </label>
                  <input
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
                    Stock price
                  </label>
                  <div className="flex min-w-0 items-end gap-1.5">
                    <input
                      type="number"
                      value={stockPriceClose}
                      onChange={(e) => setStockPriceClose(e.target.value)}
                      placeholder="0.00"
                      className="min-w-0"
                    />
                    <QuickQuoteButton
                      ticker={t.ticker}
                      onFill={(p) => setStockPriceClose(p)}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
                  Premium paid to close ($ / contract)
                </label>
                  <input
                    type="number"
                    step="0.01"
                    value={premiumClose}
                    onChange={(e) => setPremiumClose(e.target.value)}
                    placeholder="0.62"
                  />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
                    Close reason
                  </label>
                  <select
                    value={closeReason}
                    onChange={(event) =>
                      setCloseReason(event.target.value as CloseReason)
                    }
                  >
                    <option value="closed">Closed</option>
                    <option value="expired">Expired</option>
                    <option value="assigned">Assigned</option>
                    <option value="rolled">Rolled</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
                    Closing fees ($ total)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={commissionClose}
                    onChange={(event) => setCommissionClose(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <RealizedPnlPreview
                premiumOpen={t.premiumOpen}
                premiumClose={premiumClose}
                contracts={t.contracts}
                strategy={t.strategy}
                commissionOpen={t.commissionOpen}
                commissionClose={commissionClose}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancelClose}
                  className="flex-1 rounded-full border border-otto-divider bg-transparent py-[11px] text-[13.5px] text-otto-text-dim"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onConfirmClose({
                      closeDate,
                      stockPriceClose: parseFloat(stockPriceClose) || 0,
                      premiumClose: parseFloat(premiumClose) || 0,
                      commissionClose: parseFloat(commissionClose) || 0,
                      closeReason,
                    });
                    if (closeReason === "rolled") {
                      window.sessionStorage.setItem(
                        AI_TRADE_DRAFT_KEY,
                        JSON.stringify({
                          ticker: t.ticker,
                          strategy: t.strategy,
                          rolledFromTradeId: t.id,
                          notes: `Rolled from ${t.ticker} ${strikesLabel} exp ${t.expiry}`,
                        })
                      );
                      router.push("/log?draft=ai");
                    }
                  }}
                  className="flex-[2] rounded-full border-none bg-otto-green py-[11px] text-[13.5px] font-bold text-black"
                >
                  {closeReason === "rolled" ? "Close & draft roll" : "Confirm close"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtGreek(live?: number, logged?: number) {
  if (typeof live === "number" && Number.isFinite(live)) return live.toFixed(3);
  if (typeof logged === "number" && logged !== 0) return String(logged);
  return "—";
}

function fmtIv(live?: number, logged?: number) {
  if (typeof live === "number" && Number.isFinite(live)) return `${(live * 100).toFixed(1)}%`;
  if (typeof logged === "number" && logged !== 0) return `${logged}%`;
  return "—";
}

function GreekReadout({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div>
      <div className="mb-[3px] text-[10.5px] text-otto-text-faint">{label}</div>
      <div
        className="text-[13px] font-semibold text-otto-text"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
