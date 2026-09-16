"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useTrades } from "@/hooks/useTrades";
import { SummaryTile } from "@/components/performance/SummaryTile";
import {
  closedTradesInRange,
  fmtDate,
  fmtMoney,
  markPnl,
  tickerAvatarColor,
  tradePnl,
  winRateFor,
} from "@/lib/pnl";
import { fmtPct, tradeRoi } from "@/lib/roi";
import {
  closedEarly,
  tickerMonthSplit,
  tickerStats,
  tradedTickers,
} from "@/lib/tickerStats";
import type { Trade } from "@/types/trade";

export function TickerPerformance() {
  const { trades } = useTrades();
  const marks = useOptionMarks(trades);
  const [ticker, setTicker] = useScreenOption("performanceTicker");
  const [range] = useScreenOption("pnlRange");
  const closedIds = useMemo(
    () => new Set(closedTradesInRange(trades, range).map((trade) => trade.id)),
    [range, trades]
  );
  const symbols = useMemo(() => tradedTickers(trades), [trades]);
  const selected = symbols.includes(ticker) ? ticker : symbols[0] ?? "";
  const rows = useMemo(
    () =>
      trades
        .filter(
          (trade) =>
            trade.ticker === selected &&
            (trade.status === "open" || closedIds.has(trade.id))
        )
        .slice()
        .sort((a, b) => {
          const aDate = a.closeDate ?? a.openDate;
          const bDate = b.closeDate ?? b.openDate;
          return aDate < bDate ? 1 : -1;
        }),
    [closedIds, selected, trades]
  );
  const stats = useMemo(() => tickerStats(rows), [rows]);
  const months = useMemo(() => tickerMonthSplit(rows), [rows]);
  const maxAbs = Math.max(1, ...months.map((bucket) => Math.abs(bucket.pnl)));
  const unrealized = rows
    .filter((trade) => trade.status === "open")
    .reduce<number | null>((sum, trade) => {
      const mark = marks[trade.id]?.mark;
      if (typeof mark !== "number") return sum;
      return (sum ?? 0) + markPnl(trade, mark);
    }, null);
  // This view always shows unrealized, so score open positions in the win rate too.
  const winRate = useMemo(() => winRateFor(rows, marks), [rows, marks]);

  if (symbols.length === 0) {
    return (
      <div className="px-1 py-10 text-center text-sm text-otto-text-faint">
        Log a trade to review it by ticker.
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-4 max-w-[320px]">
        <label className="mb-1.5 block text-xs font-medium text-otto-text-dim">
          Ticker
        </label>
        <div className="relative">
          <select
            value={selected}
            onChange={(event) => setTicker(event.target.value)}
            className="w-full rounded-xl border border-otto-divider bg-otto-surface px-3.5 py-2.5 pr-9 text-sm font-bold"
            aria-label="Choose a ticker"
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-otto-text-faint"
          />
        </div>
      </div>

      <div className="mb-[22px] grid grid-cols-2 gap-2.5 desk:grid-cols-4">
        <SummaryTile label="Realized" value={stats.realized} />
        <SummaryTile label="Unrealized" value={unrealized} />
        <SummaryTile
          label="Win rate"
          value={null}
          display={winRate.pct == null ? "—" : `${winRate.pct}%`}
          caption={`${winRate.wins}/${winRate.counted} incl. open${
            winRate.unscored ? ` · ${winRate.unscored} no mark` : ""
          }`}
        />
        <SummaryTile
          label="Closed early"
          value={null}
          display={
            stats.closed === 0
              ? "—"
              : `${stats.earlyCount} of ${stats.closed}`
          }
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 desk:grid-cols-4">
        <SummaryTile
          label="Early P/L"
          value={stats.earlyCount ? stats.earlyPnl : null}
        />
        <SummaryTile
          label="Held to expiry P/L"
          value={stats.heldCount ? stats.heldPnl : null}
        />
        <SummaryTile
          label="Avg hold"
          value={null}
          display={stats.avgHold == null ? "—" : `${stats.avgHold}d`}
        />
        <SummaryTile
          label="Trades"
          value={null}
          display={`${stats.total} · ${stats.open} open`}
        />
      </div>

      <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-otto-text-dim">
        By month
      </div>
      {months.length === 0 ? (
        <div className="mb-6 px-1 py-6 text-center text-sm text-otto-text-faint">
          No closed trades for {selected} yet.
        </div>
      ) : (
        <div className="mb-6">
          {months.map((bucket) => (
            <div
              key={bucket.key}
              className="flex items-center gap-3 border-b border-otto-divider px-1 py-3"
            >
              <div className="w-[100px] shrink-0">
                <div className="text-[13.5px] font-semibold">{bucket.key}</div>
                <div className="text-[11px] text-otto-text-faint">
                  {bucket.count} trade{bucket.count === 1 ? "" : "s"}
                </div>
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-otto-surface">
                <div
                  className={`h-full rounded-full ${bucket.pnl >= 0 ? "bg-otto-green" : "bg-otto-red"}`}
                  style={{ width: `${(Math.abs(bucket.pnl) / maxAbs) * 100}%` }}
                />
              </div>
              <div
                className={`w-[88px] text-right text-[13.5px] font-bold ${
                  bucket.pnl >= 0 ? "text-otto-green" : "text-otto-red"
                }`}
              >
                {bucket.pnl >= 0 ? "+" : ""}
                {fmtMoney(bucket.pnl)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.4px] text-otto-text-dim">
        All {selected} trades
      </div>
      {rows.map((trade) => (
        <TickerTradeRow
          key={trade.id}
          trade={trade}
          mark={marks[trade.id]?.mark}
        />
      ))}
    </div>
  );
}

function TickerTradeRow({ trade, mark }: { trade: Trade; mark?: number }) {
  const closed = trade.status === "closed";
  const pnl = closed
    ? tradePnl(trade)
    : typeof mark === "number"
      ? markPnl(trade, mark)
      : null;
  const roi = closed ? tradeRoi(trade) : null;
  const early = closedEarly(trade);
  const avatarBg = tickerAvatarColor(trade.ticker);
  const strikes =
    trade.strategy === "Iron Condor"
      ? `${trade.longStrike}/${trade.shortStrike}P · ${trade.callShortStrike}/${trade.callLongStrike}C`
      : trade.longStrike
        ? `${trade.shortStrike} / ${trade.longStrike}`
        : `${trade.shortStrike}`;
  const statusLabel = !closed
    ? "Open"
    : trade.closeReason === "expired"
      ? "Expired"
      : trade.closeReason === "assigned"
        ? "Assigned"
        : trade.closeReason === "rolled"
          ? "Rolled"
          : early
      ? "Closed early"
      : "Held to expiry";

  return (
    <div className="flex items-center gap-3 border-b border-otto-divider px-1 py-[13px]">
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
        style={{ background: avatarBg }}
      >
        {trade.ticker.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-[7px]">
          <span className="truncate text-[15px] font-bold">{trade.strategy}</span>
          <span
            className={`shrink-0 text-[10.5px] font-semibold ${
              !closed
                ? "text-otto-text-dim"
                : early
                  ? "text-otto-amber"
                  : "text-otto-text-faint"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-otto-text-faint">
          {strikes} · {closed ? `closed ${fmtDate(trade.closeDate ?? trade.openDate)}` : `exp ${fmtDate(trade.expiry)}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`text-[14.5px] font-bold ${
            pnl == null
              ? "text-otto-text-faint"
              : pnl >= 0
                ? "text-otto-green"
                : "text-otto-red"
          }`}
        >
          {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`}
        </div>
        {closed && (
          <div
            className={`mt-0.5 text-[11px] font-semibold ${
              roi == null
                ? "text-otto-text-faint"
                : roi.roi >= 0
                  ? "text-otto-green"
                  : "text-otto-red"
            }`}
          >
            {roi == null ? "ROI —" : `${fmtPct(roi.roi)} · ${fmtPct(roi.annualized)}/yr`}
          </div>
        )}
      </div>
    </div>
  );
}
