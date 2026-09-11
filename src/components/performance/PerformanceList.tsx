"use client";

import { useMemo } from "react";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useTrades } from "@/hooks/useTrades";
import { Tabs } from "@/components/ui/Tabs";
import { fmtDate, fmtMoney, groupClosedTrades, summarize, tickerAvatarColor, tradePnl } from "@/lib/pnl";
import type { Trade } from "@/types/trade";

function SummaryTile({
  label,
  value,
  display,
}: {
  label: string;
  value: number | null;
  display?: string;
}) {
  const positive = value === null ? true : value >= 0;
  return (
    <div className="rounded-xl bg-otto-surface px-3.5 py-[13px]">
      <div className="mb-[5px] text-[11px] text-otto-text-faint">{label}</div>
      <div
        className={`text-[17px] font-bold ${
          value === null ? "text-otto-text" : positive ? "text-otto-green" : "text-otto-red"
        }`}
      >
        {display ?? `${positive ? "+" : ""}${fmtMoney(value ?? 0)}`}
      </div>
    </div>
  );
}

export function PerformanceList() {
  const { trades } = useTrades();
  const [period, setPeriod] = useScreenOption("performancePeriod");
  const closed = useMemo(
    () => trades.filter((trade) => trade.status === "closed"),
    [trades]
  );
  const { allTime, mtd, wtd, winRate, closedCount, wins } = summarize(closed);
  const grouped = useMemo(() => groupClosedTrades(closed, period), [closed, period]);
  const maxAbs = Math.max(1, ...grouped.map((g) => Math.abs(g.pnl)));
  const closedRows = useMemo(
    () =>
      closed
        .slice()
        .sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? "")),
    [closed]
  );

  return (
    <div>
      <p className="mb-3.5 text-[12.5px] leading-snug text-otto-text-faint">
        Realized P/L from closed trades only. Open positions and live marks are not included.
      </p>

      <div className="mb-[22px] mt-0.5 grid grid-cols-2 gap-2.5 desk:grid-cols-4">
        <SummaryTile label="All-time" value={allTime} />
        <SummaryTile label="This month" value={mtd} />
        <SummaryTile label="This week" value={wtd} />
        <SummaryTile
          label="Win rate"
          value={null}
          display={winRate == null ? "—" : `${winRate}%`}
        />
      </div>

      <div className="mb-1 flex items-end justify-between">
        <span className="pb-3 text-[13px] text-otto-text-faint">
          {closedCount} closed trade{closedCount === 1 ? "" : "s"}
          {wins != null && closedCount > 0 ? ` · ${wins} win${wins === 1 ? "" : "s"}` : ""}
        </span>
        <Tabs
          value={period}
          onChange={setPeriod}
          options={[
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
        />
      </div>

      <div>
        {grouped.length === 0 && (
          <div className="px-1 py-[30px] text-center text-sm text-otto-text-faint">
            Close a position to see realized P/L here. Open trades stay on Positions until they are closed.
          </div>
        )}
        {grouped.map((g) => (
          <div
            key={g.key}
            className="flex items-center gap-3 border-b border-otto-divider px-1 py-3"
          >
            <div className="w-[100px] shrink-0">
              <div className="text-[13.5px] font-semibold">{g.key}</div>
              <div className="text-[11px] text-otto-text-faint">
                {g.count} trade{g.count > 1 ? "s" : ""}
              </div>
            </div>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-otto-surface">
              <div
                className={`h-full rounded-full ${g.pnl >= 0 ? "bg-otto-green" : "bg-otto-red"}`}
                style={{ width: `${(Math.abs(g.pnl) / maxAbs) * 100}%` }}
              />
            </div>
            <div
              className={`w-[88px] text-right text-[13.5px] font-bold ${
                g.pnl >= 0 ? "text-otto-green" : "text-otto-red"
              }`}
            >
              {g.pnl >= 0 ? "+" : ""}
              {fmtMoney(g.pnl)}
            </div>
          </div>
        ))}
      </div>

      {closedRows.length > 0 && (
        <>
          <div className="mb-3 mt-8 text-[13px] font-bold uppercase tracking-[0.4px] text-otto-text-dim">
            Closed trades
          </div>
          {closedRows.map((trade) => (
            <ClosedTradeRow key={trade.id} trade={trade} />
          ))}
        </>
      )}
    </div>
  );
}

function ClosedTradeRow({ trade }: { trade: Trade }) {
  const pnl = tradePnl(trade);
  const avatarBg = tickerAvatarColor(trade.ticker);
  const strikes =
    trade.strategy === "Iron Condor"
      ? `${trade.longStrike}/${trade.shortStrike}P · ${trade.callShortStrike}/${trade.callLongStrike}C`
      : trade.longStrike
        ? `${trade.shortStrike} / ${trade.longStrike}`
        : `${trade.shortStrike}`;

  return (
    <div className="flex items-center gap-3 border-b border-otto-divider px-1 py-[13px]">
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
        style={{ background: avatarBg }}
      >
        {trade.ticker.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[7px]">
          <span className="text-[15px] font-bold">{trade.ticker}</span>
          <span className="text-xs text-otto-text-faint">{trade.strategy}</span>
        </div>
        <div className="mt-0.5 text-xs text-otto-text-faint">
          {strikes} · closed {trade.closeDate ? fmtDate(trade.closeDate) : ""}
        </div>
      </div>
      <div
        className={`shrink-0 text-right text-[14.5px] font-bold ${
          pnl != null && pnl >= 0 ? "text-otto-green" : "text-otto-red"
        }`}
      >
        {pnl != null && pnl >= 0 ? "+" : ""}
        {fmtMoney(pnl ?? 0)}
      </div>
    </div>
  );
}
