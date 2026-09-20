"use client";

import { useMemo } from "react";
import { ChevronDown, Download } from "lucide-react";
import { PerformanceAiCoach } from "@/components/performance/PerformanceAiCoach";
import { TradeScopeToggle } from "@/components/ui/TradeScopeToggle";
import { DuplicateTradeReview } from "@/components/performance/DuplicateTradeReview";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useTrades } from "@/hooks/useTrades";
import { downloadJournalCsv } from "@/lib/journalExport";
import {
  closedTradesInRange,
  fmtDate,
  fmtMoney,
  groupClosedTrades,
  markPnl,
  PNL_RANGE_OPTIONS,
  summarize,
  tickerAvatarColor,
  tradePnl,
  unrealizedFromMarks,
  winRateFor,
} from "@/lib/pnl";
import {
  assignmentCapital,
  assignmentDetail,
  capitalUsed,
  fmtPct,
  tradeRoi,
} from "@/lib/roi";
import type { Trade } from "@/types/trade";
import { tradesInScope } from "@/lib/tradeScope";

type BreakdownRow = { key: string; pnl: number; count: number };

export function PerformanceDashboard() {
  const { trades } = useTrades();
  const marks = useOptionMarks(trades);
  const [view, setView] = useScreenOption("performanceView");
  const [range, setRange] = useScreenOption("pnlRange");
  const [includeOpen, setIncludeOpen] = useScreenOption("performanceUnrealized");
  const [period, setPeriod] = useScreenOption("performancePeriod");
  const [tradeScope] = useScreenOption("tradeScope");
  const scopedTrades = useMemo(
    () => tradesInScope(trades, tradeScope),
    [tradeScope, trades]
  );

  const closed = useMemo(
    () => closedTradesInRange(scopedTrades, range),
    [range, scopedTrades]
  );
  const open = useMemo(
    () =>
      scopedTrades
        .filter((trade) => trade.status === "open")
        .slice()
        .sort(
          (a, b) =>
            a.expiry.localeCompare(b.expiry) ||
            a.ticker.localeCompare(b.ticker)
        ),
    [scopedTrades]
  );
  const summary = useMemo(() => summarize(closed), [closed]);
  const realized = summary.allTime;
  const unrealized = unrealizedFromMarks(scopedTrades, marks);
  const rangeLabel =
    PNL_RANGE_OPTIONS.find((option) => option.id === range)?.label ??
    "Selected period";
  const winRate = useMemo(
    () =>
      includeOpen
        ? winRateFor([...closed, ...open], marks)
        : winRateFor(closed),
    [closed, includeOpen, marks, open]
  );
  const wins = closed
    .map((trade) => tradePnl(trade))
    .filter((pnl): pnl is number => pnl != null && pnl > 0);
  const losses = closed
    .map((trade) => tradePnl(trade))
    .filter((pnl): pnl is number => pnl != null && pnl < 0);
  const avgWin = wins.length
    ? wins.reduce((sum, pnl) => sum + pnl, 0) / wins.length
    : null;
  const avgLoss = losses.length
    ? losses.reduce((sum, pnl) => sum + pnl, 0) / losses.length
    : null;

  const assignment = useMemo(
    () => assignmentDetail(scopedTrades),
    [scopedTrades]
  );
  const concentration = useMemo(
    () => assignmentConcentration(scopedTrades),
    [scopedTrades]
  );
  const cumulative = useMemo(() => cumulativeSeries(closed), [closed]);
  const capitalRows = useMemo(
    () =>
      closed
        .map((trade) => ({ trade, capital: capitalUsed(trade) }))
        .filter(
          (
            row
          ): row is {
            trade: Trade;
            capital: number;
          } => row.capital != null && row.capital > 0
        )
        .sort((a, b) =>
          (a.trade.closeDate ?? "").localeCompare(b.trade.closeDate ?? "")
        ),
    [closed]
  );
  const grouped = useMemo(
    () => groupClosedTrades(closed, period),
    [closed, period]
  );
  const closedSorted = useMemo(
    () =>
      closed
        .slice()
        .sort((a, b) =>
          (b.closeDate ?? "").localeCompare(a.closeDate ?? "")
        ),
    [closed]
  );
  const byTicker = useMemo(
    () => groupPerformance(closed, (trade) => normalizeTicker(trade.ticker)),
    [closed]
  );
  const byStrategy = useMemo(
    () => groupPerformance(closed, (trade) => String(trade.strategy)),
    [closed]
  );

  return (
    <div className="mx-auto max-w-[720px] pb-8">
      <PerformanceTabs view={view} onChange={setView} />

      {view === "overview" ? (
        <>
          <div className="relative mb-3">
            <select
              value={range}
              onChange={(event) =>
                setRange(event.target.value as typeof range)
              }
              aria-label="Performance date range"
              className="w-full rounded-[10px] border-0 bg-otto-surface px-3.5 py-2.5 pr-9 text-[13.5px] font-medium"
            >
              {PNL_RANGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-otto-text-dim"
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <PerformanceAiCoach />
            <div className="inline-flex rounded-full border border-otto-divider p-0.5">
              <Pill
                active={!includeOpen}
                onClick={() => setIncludeOpen(false)}
                label="Realized"
              />
              <Pill
                active={includeOpen}
                onClick={() => setIncludeOpen(true)}
                label="All"
              />
            </div>
            <TradeScopeToggle compact spreadsFirst />
          </div>

          <DuplicateTradeReview />

          <div className="mb-2.5 grid grid-cols-2 gap-2.5 desk:grid-cols-4">
            {includeOpen ? (
              <>
                <StatTile label="Realized" value={signedMoney(realized)} positive={realized >= 0} />
                <StatTile
                  label="Unrealized"
                  value={unrealized == null ? "—" : signedMoney(unrealized)}
                  positive={unrealized != null && unrealized >= 0}
                  negative={unrealized != null && unrealized < 0}
                />
                <StatTile
                  label="Combined"
                  value={
                    unrealized == null ? "—" : signedMoney(realized + unrealized)
                  }
                  positive={unrealized != null && realized + unrealized >= 0}
                  negative={unrealized != null && realized + unrealized < 0}
                />
                <StatTile
                  label="Win rate"
                  value={winRate.pct == null ? "—" : `${winRate.pct}%`}
                  sub={`${winRate.wins}/${winRate.counted} incl. open`}
                />
              </>
            ) : (
              <>
                <StatTile
                  label={rangeLabel}
                  value={signedMoney(realized)}
                  positive={realized >= 0}
                  negative={realized < 0}
                />
                <StatTile
                  label="Trades"
                  value={String(summary.closedCount)}
                  sub="closed in period"
                />
                <StatTile
                  label="Wins"
                  value={String(summary.wins ?? 0)}
                  sub="profitable trades"
                />
                <StatTile
                  label="Win rate"
                  value={winRate.pct == null ? "—" : `${winRate.pct}%`}
                  sub={`${winRate.wins}/${winRate.counted} closed`}
                />
              </>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between rounded-xl bg-otto-surface px-3.5 py-3">
            <Metric
              label="Avg win"
              value={avgWin == null ? "—" : signedMoney(avgWin)}
              tone="positive"
            />
            <div className="h-7 w-px bg-otto-divider" />
            <Metric
              label="Avg loss"
              value={avgLoss == null ? "— no losses yet" : fmtMoney(avgLoss)}
              tone={avgLoss == null ? "muted" : "negative"}
              align="right"
            />
          </div>

          <AssignmentCard
            detail={assignment}
            concentration={concentration}
          />

          <GrowthCard points={cumulative} total={realized} />
          <CapitalCard rows={capitalRows} />

          <div className="mb-2.5 flex items-end justify-between gap-2">
            <span className="text-[12.5px] text-otto-text-dim">
              {rangeLabel} · {summary.closedCount} closed trade
              {summary.closedCount === 1 ? "" : "s"} · {summary.wins ?? 0} wins
            </span>
            <div className="flex gap-3">
              <TextTab
                active={period === "weekly"}
                onClick={() => setPeriod("weekly")}
                label="Weekly"
              />
              <TextTab
                active={period === "monthly"}
                onClick={() => setPeriod("monthly")}
                label="Monthly"
              />
            </div>
          </div>

          <PeriodRows rows={grouped} />

          {includeOpen && (
            <TradeSection title="Open positions">
              {open.length ? (
                open.map((trade) => (
                  <OpenTradeRow
                    key={trade.id}
                    trade={trade}
                    mark={marks[trade.id]?.mark}
                  />
                ))
              ) : (
                <EmptyState text="No open positions." />
              )}
            </TradeSection>
          )}

          <div className="mb-1 mt-6 flex items-center justify-between">
            <h3 className="text-[13px] font-bold">Closed trades</h3>
            {scopedTrades.length > 0 && (
              <button
                type="button"
                onClick={() => downloadJournalCsv(scopedTrades)}
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-otto-text-faint"
              >
                <Download size={12} />
                Export journal
              </button>
            )}
          </div>
          {closedSorted.length ? (
            closedSorted.map((trade) => (
              <ClosedTradeRow key={trade.id} trade={trade} />
            ))
          ) : (
            <EmptyState
              text={`No closed trades in ${rangeLabel.toLowerCase()}.`}
            />
          )}
        </>
      ) : (
        <BreakdownList
          rows={view === "ticker" ? byTicker : byStrategy}
          total={realized}
        />
      )}
    </div>
  );
}

function PerformanceTabs({
  view,
  onChange,
}: {
  view: "overview" | "ticker" | "strategy";
  onChange: (view: "overview" | "ticker" | "strategy") => void;
}) {
  return (
    <div className="mb-4 flex gap-5 border-b border-otto-divider">
      {[
        ["overview", "Overview"],
        ["ticker", "By ticker"],
        ["strategy", "By strategy"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value as typeof view)}
          className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold ${
            view === value
              ? "border-otto-green text-otto-text"
              : "border-transparent text-otto-text-faint"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl bg-otto-surface px-3.5 py-3">
      <div className="mb-1 text-[11.5px] text-otto-text-dim">{label}</div>
      <div
        className={`text-[19px] font-extrabold ${
          positive
            ? "text-otto-green"
            : negative
              ? "text-otto-red"
              : "text-otto-text"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10.5px] text-otto-text-faint">{sub}</div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  align = "left",
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "muted";
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="mb-0.5 text-[11px] text-otto-text-dim">{label}</div>
      <div
        className={`text-base font-bold ${
          tone === "positive"
            ? "text-otto-green"
            : tone === "negative"
              ? "text-otto-red"
              : "text-otto-text-faint"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
        active
          ? "bg-otto-text text-otto-bg"
          : "text-otto-text-dim"
      }`}
    >
      {label}
    </button>
  );
}

function TextTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 pb-0.5 text-[12.5px] font-semibold ${
        active
          ? "border-otto-green text-otto-text"
          : "border-transparent text-otto-text-faint"
      }`}
    >
      {label}
    </button>
  );
}

function AssignmentCard({
  detail,
  concentration,
}: {
  detail: ReturnType<typeof assignmentDetail>;
  concentration: { ticker: string; amount: number }[];
}) {
  if (!detail.counted) {
    return (
      <div className="mb-4 rounded-[14px] bg-otto-surface p-4">
        <div className="text-[12.5px] text-otto-text-dim">
          Assignment cash backup
        </div>
        <div className="mt-2 text-xs text-otto-text-faint">
          No open short-put positions currently carry assignment cash risk.
        </div>
      </div>
    );
  }
  const biggest = concentration[0] ?? null;
  return (
    <div className="mb-4 rounded-[14px] bg-otto-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[12.5px] text-otto-text-dim">
          Assignment cash backup
        </div>
        <div className="text-[19px] font-extrabold">
          {fmtMoney(detail.total)}
        </div>
      </div>
      <div className="mt-2 text-[11px] text-otto-text-faint">
        {detail.counted} short-put position{detail.counted === 1 ? "" : "s"} ·{" "}
        {detail.shares.toLocaleString()} shares if all assigned
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full">
        {concentration.map((item) => (
          <div
            key={item.ticker}
            style={{
              width: `${(item.amount / detail.total) * 100}%`,
              background: tickerAvatarColor(item.ticker),
            }}
            title={`${item.ticker} ${fmtMoney(item.amount)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
        {concentration.map((item) => (
          <div
            key={item.ticker}
            className="flex items-center gap-1 text-[10.5px] text-otto-text-dim"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: tickerAvatarColor(item.ticker) }}
            />
            {item.ticker} {Math.round((item.amount / detail.total) * 100)}%
          </div>
        ))}
      </div>
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <MiniStat
          label="Biggest name"
          value={biggest?.ticker ?? "—"}
          sub={
            biggest
              ? `${fmtMoney(biggest.amount)} · ${Math.round(
                  (biggest.amount / detail.total) * 100
                )}%`
              : ""
          }
        />
        <MiniStat
          label="Credit held"
          value={fmtMoney(detail.creditOpen)}
          sub="premium on these legs"
        />
        <MiniStat
          label="Open puts"
          value={String(detail.counted)}
          sub="carry assignment risk"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-otto-text-faint">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-bold">{value}</div>
      <div className="mt-0.5 text-[9.5px] leading-tight text-otto-text-faint">
        {sub}
      </div>
    </div>
  );
}

function GrowthCard({
  points,
  total,
}: {
  points: { date: string; value: number }[];
  total: number;
}) {
  if (!points.length) return null;
  return (
    <div className="mb-4 rounded-[14px] bg-otto-surface p-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <div className="text-[12.5px] text-otto-text-dim">
          Growth since {fmtDate(points[0].date)}
        </div>
        <div
          className={`text-[15px] font-bold ${
            total >= 0 ? "text-otto-green" : "text-otto-red"
          }`}
        >
          {signedMoney(total)}
        </div>
      </div>
      <CumulativeChart points={points} />
    </div>
  );
}

function CumulativeChart({
  points,
}: {
  points: { date: string; value: number }[];
}) {
  const width = 360;
  const height = 84;
  const pad = 4;
  const values = [0, ...points.map((point) => point.value)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => [
    pad + index * step,
    height - pad - ((point.value - min) / span) * (height - pad * 2),
  ]);
  const line = coords
    .map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`)
    .join(" ");
  const area = `${line} L${coords.at(-1)?.[0] ?? pad},${height} L${coords[0]?.[0] ?? pad},${height} Z`;
  const positive = points.at(-1)?.value ? points.at(-1)!.value >= 0 : true;
  const color = positive ? "rgb(var(--otto-green))" : "rgb(var(--otto-red))";
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-label="Cumulative realized profit and loss"
      role="img"
    >
      <path d={area} fill={color} opacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map(([x, y], index) => (
        <circle key={points[index].date} cx={x} cy={y} r="2.3" fill={color} />
      ))}
    </svg>
  );
}

function CapitalCard({
  rows,
}: {
  rows: { trade: Trade; capital: number }[];
}) {
  if (!rows.length) return null;
  const values = rows.map((row) => row.capital);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const displayed = rows.slice(-90);
  return (
    <div className="mb-4 rounded-[14px] bg-otto-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[12.5px] text-otto-text-dim">
          Capital per trade
        </div>
        <div className="text-[11px] text-otto-text-faint">
          {fmtMoney(min)} – {fmtMoney(max)}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-otto-text-faint">
        {(max / min).toFixed(1)}x range across closed trades
        {max / min >= 3 ? " — worth a sizing rule" : ""}
        {rows.length > displayed.length
          ? ` · latest ${displayed.length} shown`
          : ""}
      </div>
      <div className="mt-2.5 flex h-9 min-w-0 items-end gap-px overflow-hidden">
        {displayed.map(({ trade, capital }) => (
          <div
            key={trade.id}
            title={`${trade.ticker} · ${fmtMoney(capital)}`}
            className="min-w-0 flex-1 rounded-sm"
            style={{
              height: `${Math.max(12, (capital / max) * 100)}%`,
              background: tickerAvatarColor(trade.ticker),
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PeriodRows({
  rows,
}: {
  rows: ReturnType<typeof groupClosedTrades>;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.pnl)));
  if (!rows.length) return null;
  return (
    <div>
      {rows.map((row) => (
        <div key={row.key} className="mb-3">
          <div className="mb-1 flex justify-between text-[12.5px]">
            <span className="font-semibold">{row.key}</span>
            <span
              className={`font-bold ${
                row.pnl >= 0 ? "text-otto-green" : "text-otto-red"
              }`}
            >
              {signedMoney(row.pnl)}
            </span>
          </div>
          <div className="mb-1 text-[11px] text-otto-text-faint">
            {row.count} trade{row.count === 1 ? "" : "s"}
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-otto-surface">
            <div
              className={`h-full rounded-full ${
                row.pnl >= 0 ? "bg-otto-green" : "bg-otto-red"
              }`}
              style={{ width: `${(Math.abs(row.pnl) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownList({
  rows,
  total,
}: {
  rows: BreakdownRow[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.pnl)));
  if (!rows.length) {
    return <EmptyState text="No closed trades in this period." />;
  }
  return (
    <div className="pt-1">
      {rows.map((row) => {
        const positive = row.pnl >= 0;
        const share = total === 0 ? null : Math.round((row.pnl / total) * 100);
        return (
          <div key={row.key} className="border-b border-otto-divider py-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: tickerAvatarColor(row.key) }}
                />
                <span className="truncate text-sm font-bold">{row.key}</span>
                <span className="shrink-0 text-[11.5px] text-otto-text-faint">
                  {row.count} trade{row.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2">
                {share != null && (
                  <span className="text-[11.5px] text-otto-text-faint">
                    {share}% of total
                  </span>
                )}
                <span
                  className={`text-sm font-bold ${
                    positive ? "text-otto-green" : "text-otto-red"
                  }`}
                >
                  {signedMoney(row.pnl)}
                </span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-otto-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(Math.abs(row.pnl) / max) * 100}%`,
                  background: positive
                    ? tickerAvatarColor(row.key)
                    : "rgb(var(--otto-red))",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <h3 className="mb-1 mt-6 text-[13px] font-bold">{title}</h3>
      {children}
    </>
  );
}

function OpenTradeRow({ trade, mark }: { trade: Trade; mark?: number }) {
  const pnl = typeof mark === "number" ? markPnl(trade, mark) : null;
  return (
    <TradeRowShell trade={trade}>
      <div
        className={`text-sm font-bold ${
          pnl == null
            ? "text-otto-text-faint"
            : pnl >= 0
              ? "text-otto-green"
              : "text-otto-red"
        }`}
      >
        {pnl == null ? "—" : signedMoney(pnl)}
      </div>
      <div className="mt-0.5 text-[11px] text-otto-text-faint">
        exp {fmtDate(trade.expiry)}
      </div>
    </TradeRowShell>
  );
}

function ClosedTradeRow({ trade }: { trade: Trade }) {
  const pnl = tradePnl(trade) ?? 0;
  const roi = tradeRoi(trade);
  const velocity = velocityLabel(roi);
  return (
    <TradeRowShell trade={trade} capital={roi?.capital}>
      <div
        className={`text-sm font-bold ${
          pnl >= 0 ? "text-otto-green" : "text-otto-red"
        }`}
      >
        {signedMoney(pnl)}
      </div>
      <div
        className={`mt-0.5 text-[11px] ${
          pnl >= 0 ? "text-otto-green" : "text-otto-red"
        }`}
      >
        {roi ? `${fmtPct(roi.roi)} · ${velocity}` : "ROI —"}
      </div>
    </TradeRowShell>
  );
}

function TradeRowShell({
  trade,
  capital,
  children,
}: {
  trade: Trade;
  capital?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-otto-divider py-[11px]">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: tickerAvatarColor(trade.ticker) }}
      >
        {trade.ticker.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">
          {trade.ticker}{" "}
          <span className="text-[12.5px] font-medium text-otto-text-dim">
            {trade.strategy}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-otto-text-faint">
          {trade.status === "closed"
            ? `closed ${fmtDate(trade.closeDate ?? trade.openDate)}`
            : `opened ${fmtDate(trade.openDate)}`}
          {capital ? ` · ${fmtMoney(capital)} capital` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-otto-text-faint">{text}</div>
  );
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${fmtMoney(value)}`;
}

function normalizeTicker(ticker: string) {
  return ticker.toUpperCase() === "GOOG" ? "GOOGL" : ticker.toUpperCase();
}

function groupPerformance(
  trades: Trade[],
  keyFor: (trade: Trade) => string
): BreakdownRow[] {
  const grouped = new Map<string, BreakdownRow>();
  for (const trade of trades) {
    const pnl = tradePnl(trade);
    if (pnl == null) continue;
    const key = keyFor(trade);
    const row = grouped.get(key) ?? { key, pnl: 0, count: 0 };
    row.pnl += pnl;
    row.count += 1;
    grouped.set(key, row);
  }
  return Array.from(grouped.values()).sort((a, b) => b.pnl - a.pnl);
}

function cumulativeSeries(trades: Trade[]) {
  const sorted = trades
    .filter((trade) => trade.closeDate && tradePnl(trade) != null)
    .slice()
    .sort((a, b) =>
      (a.closeDate ?? "").localeCompare(b.closeDate ?? "")
    );
  let total = 0;
  const byDate = new Map<string, number>();
  for (const trade of sorted) {
    total += tradePnl(trade) ?? 0;
    byDate.set(trade.closeDate!, total);
  }
  return Array.from(byDate, ([date, value]) => ({ date, value }));
}

function assignmentConcentration(trades: Trade[]) {
  const grouped = new Map<string, number>();
  for (const trade of trades) {
    if (trade.status !== "open") continue;
    const amount = assignmentCapital(trade);
    if (amount == null || amount <= 0) continue;
    const ticker = normalizeTicker(trade.ticker);
    grouped.set(ticker, (grouped.get(ticker) ?? 0) + amount);
  }
  return Array.from(grouped, ([ticker, amount]) => ({ ticker, amount })).sort(
    (a, b) => b.amount - a.amount
  );
}

function velocityLabel(roi: ReturnType<typeof tradeRoi>) {
  if (!roi) return "";
  if (roi.days < 5) {
    return `${fmtMoney(roi.pnl / roi.days)}/day · ${roi.days}d hold`;
  }
  const annualized = Math.abs(roi.annualized * 100);
  const capped = Math.min(annualized, 999);
  return `${roi.annualized < 0 ? "-" : ""}${capped.toFixed(0)}${
    annualized > 999 ? "+" : ""
  }%/yr`;
}
