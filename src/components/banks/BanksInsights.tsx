"use client";

import { useState } from "react";
import { balanceChanges, bucketChanges, dailySeries, worthMilestone, type HoldingBucket, type WorthPoint } from "@/lib/banksHistory";
import { bankFocus, displayCurrency, money, moneyWhole, netWorth, toHome, totalsRate } from "@/lib/banks";
import { fmtDate, todayISO } from "@/lib/pnl";
import type { BanksPreferences } from "@/lib/banksPreferences";
import type { BankAccount, BankDeposit, BankSnapshot } from "@/types/bank";

export function BanksActivity({
  accounts,
  deposits,
  snapshots,
  loading,
  onOpenDeposit,
}: {
  accounts: BankAccount[];
  deposits: BankDeposit[];
  snapshots: BankSnapshot[];
  loading: boolean;
  onOpenDeposit: (id: string) => void;
}) {
  const focus = bankFocus(deposits);
  const changes = balanceChanges(snapshots, accounts, deposits);
  const empty = accounts.length === 0 && deposits.length === 0;
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Activity</h1>
      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Coming up</p>
      {focus.length === 0 && (
        <p className="rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
          {loading || empty
            ? loading
              ? "Loading accounts…"
              : "Maturity and interest dates show up here."
            : "Nothing matures in the next 45 days, and no interest is due in the next 3 weeks."}
        </p>
      )}
      <div className="space-y-2">
        {focus.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpenDeposit(item.depositId)} className="block w-full rounded-2xl bg-otto-surface px-4 py-3 text-left">
            <span className="block truncate text-[15px] font-extrabold">{item.title}</span>
            <span className="mt-0.5 block text-[12px] text-otto-text-dim">{item.detail}</span>
          </button>
        ))}
      </div>
      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Balance changes</p>
      {changes.length === 0 && (
        <p className="rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
          Each saved balance is kept from now on. A change shows here after the amount moves.
        </p>
      )}
      <div className="space-y-2">
        {changes.map((item) => {
          const delta = item.after - item.before;
          return (
            <div key={`${item.holdingKind}-${item.holdingId}`} className="rounded-2xl bg-otto-surface px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[15px] font-extrabold">{item.title}</span>
                <span className={`shrink-0 text-[14px] font-bold ${delta < 0 ? "text-otto-red" : "text-otto-green"}`}>
                  {delta > 0 ? "+" : ""}
                  {money(delta, item.currency)}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-otto-text-dim">
                {item.currency} · {money(item.before, item.currency)} to {money(item.after, item.currency)} · {fmtDate(item.recordedOn)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function BanksPerformance({
  accounts,
  deposits,
  snapshots,
  prefs,
  historyNote,
  onOpenSettings,
}: {
  accounts: BankAccount[];
  deposits: BankDeposit[];
  snapshots: BankSnapshot[];
  prefs: BanksPreferences;
  historyNote: string;
  onOpenSettings?: () => void;
}) {
  const [range, setRange] = useState<RangeId>("1M");
  const { rate, fallback } = totalsRate(accounts, deposits, prefs.inrPerUsd);
  const shown = displayCurrency(accounts, deposits, prefs.home);
  const worth = netWorth(accounts, deposits, shown, rate);
  const series = dailySeries(snapshots, accounts, deposits, shown, rate);
  const from = rangeStart(range);
  const points = inRange(series, from);
  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last && points.length > 1 ? last.total - first.total : null;
  const changePct = change != null && first.total !== 0 ? (change / Math.abs(first.total)) * 100 : null;
  const split = bucketChanges(snapshots, accounts, deposits, shown, rate, from ?? first?.date ?? null);
  const tradingPoints = inRange(dailySeries(snapshots, accounts, deposits, shown, rate, "investments"), from);
  const tradingPct =
    split && split.start.investments > 0 ? (split.investments / split.start.investments) * 100 : null;
  const milestone = worthMilestone(series);
  const assets = worth.cash + worth.deposits + worth.investments;
  const debtRatio = assets > 0 ? (worth.liabilities / assets) * 100 : null;
  const slices = [
    { label: "Cash", amount: worth.cash, dot: "bg-otto-green" },
    { label: "Deposits", amount: worth.deposits, dot: "bg-otto-amber" },
    { label: "Trading", amount: worth.investments, dot: "bg-[#3d6ea8]" },
  ].filter((part) => part.amount > 0);
  const openDeposits = deposits.filter((item) => !item.closed);
  const rated = openDeposits.filter((item) => item.rate != null && item.principal > 0);
  let weighted = 0;
  let weight = 0;
  for (const item of rated) {
    const value = toHome(item.principal, item.currency, shown, rate) ?? item.principal;
    weighted += value * (item.rate ?? 0);
    weight += value;
  }
  const today = todayISO();
  const ladder = openDeposits
    .filter((item) => item.maturesOn && item.maturesOn >= today)
    .sort((left, right) => (left.maturesOn ?? "").localeCompare(right.maturesOn ?? ""));
  const nextMaturity = ladder[0]?.maturesOn ?? undefined;
  const changes = split
    ? (
        [
          { key: "investments", label: "Trading", bar: "bg-[#3d6ea8]" },
          { key: "cash", label: "Cash", bar: "bg-otto-green" },
          { key: "deposits", label: "Deposits", bar: "bg-otto-amber" },
          { key: "liabilities", label: "Cards and loans", bar: "bg-otto-red" },
        ] as { key: HoldingBucket; label: string; bar: string }[]
      )
        .map((row) => ({ ...row, amount: split[row.key] }))
        .filter((row) => Math.round(row.amount) !== 0)
        .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    : [];
  const largest = Math.max(1, ...changes.map((row) => Math.abs(row.amount)));
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Performance</h1>
      {historyNote && <p className="mt-3 rounded-xl bg-otto-amber-soft px-3.5 py-3 text-[12px] text-otto-amber">{historyNote}</p>}
      <div className="mt-4 rounded-2xl bg-otto-surface px-4 py-4">
        <div className="text-[12px] text-otto-text-dim">Total balance</div>
        <div className="mt-1 text-[34px] font-black leading-none tracking-[-0.6px]">
          {worth.total == null ? "—" : moneyWhole(worth.total, shown)}
        </div>
        {change != null && first ? (
          <span
            className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[12px] font-bold ${
              change < 0 ? "bg-otto-red-soft text-otto-red" : "bg-otto-green-soft text-otto-green"
            }`}
          >
            {signedMoney(change, shown)}
            {changePct != null ? ` (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)` : ""} since {fmtDate(first.date)}
          </span>
        ) : (
          <p className="mt-3 text-[12px] text-otto-text-dim">Chart starts after your next update</p>
        )}
        {points.length > 1 ? <BalanceChart points={points} currency={shown} /> : <ChartWaiting />}
        {series.length > 1 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {RANGES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRange(id)}
                className={`rounded-full py-2 text-[12px] font-bold ${
                  range === id ? "bg-otto-green text-black" : "border border-otto-divider text-otto-text-dim"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        )}
        {fallback && (
          <p className="mt-3 text-[11px] leading-snug text-otto-text-dim">
            Using 1 USD = 100 INR until you save a rate{" "}
            {onOpenSettings ? (
              <button type="button" onClick={onOpenSettings} className="font-bold text-otto-amber">
                in Settings
              </button>
            ) : (
              "in Settings"
            )}
            .
          </p>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-otto-surface px-4 py-4">
          <div className="text-[12px] text-otto-text-dim">Trading change</div>
          <div
            className={`mt-1 text-[26px] font-black leading-none ${
              tradingPct == null ? "" : tradingPct < 0 ? "text-otto-red" : "text-otto-green"
            }`}
          >
            {tradingPct == null ? "—" : `${tradingPct > 0 ? "+" : ""}${tradingPct.toFixed(1)}%`}
          </div>
          {tradingPoints.length > 1 ? (
            <Sparkline points={tradingPoints.map((point) => point.total)} />
          ) : (
            <p className="mt-2 text-[11px] text-otto-text-dim">Needs two saved balances.</p>
          )}
          <p className="mt-1 text-[10.5px] leading-snug text-otto-text-faint">Includes money moved in or out.</p>
        </div>
        <div className="rounded-2xl bg-otto-surface px-4 py-4">
          <div className="text-[12px] text-otto-text-dim">Debt ratio</div>
          <div className={`mt-1 text-[26px] font-black leading-none ${debtRatio ? "text-otto-red" : ""}`}>
            {debtRatio == null ? "—" : `${Math.round(debtRatio)}%`}
          </div>
          <p className="mt-2 text-[12px] text-otto-text-dim">of assets</p>
        </div>
      </div>
      {points.length > 1 && (
        <div className="mt-3 rounded-2xl bg-otto-surface px-4 py-4">
          <div className="text-[15px] font-extrabold">What changed</div>
          <p className="mt-0.5 text-[12px] text-otto-text-dim">
            {change != null && first ? `Split of the ${signedMoney(change, shown)} since ${fmtDate(first.date)}` : "This range"}
          </p>
          {changes.length === 0 && <p className="mt-3 text-[13px] text-otto-text-dim">No balances moved in this range.</p>}
          <div className="mt-3 space-y-3">
            {changes.map((row) => (
              <div key={row.key}>
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="font-bold">{row.label}</span>
                  <span className={`font-bold tabular-nums ${row.amount < 0 ? "text-otto-red" : "text-otto-green"}`}>
                    {signedMoney(row.amount, shown)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-otto-bg">
                  <span className={`block h-full rounded-full ${row.bar}`} style={{ width: `${(Math.abs(row.amount) / largest) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <MilestoneCard milestone={milestone} currency={shown} />
      <div className="mt-3 rounded-2xl bg-otto-surface px-4 py-4">
        <div className="text-[12px] text-otto-text-dim">Where it sits</div>
        <AllocationBar slices={slices} total={assets} />
        <div className="mt-3 space-y-2.5">
          {slices.map((part) => (
            <MixRow key={part.label} dot={part.dot} label={part.label} amount={moneyWhole(part.amount, shown)} share={shareOf(part.amount, assets)} />
          ))}
          {worth.liabilities > 0 && (
            <MixRow
              dot="bg-otto-red"
              label="Cards and loans"
              amount={moneyWhole(-worth.liabilities, shown)}
              share="out"
              negative
            />
          )}
        </div>
      </div>
      {assets > 0 && (
        <div className="mt-3 rounded-2xl bg-otto-surface px-4 py-4">
          <div className="text-[15px] font-extrabold">Assets vs. debt</div>
          <AllocationBar slices={slices} total={assets} />
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-otto-text-dim">Assets {moneyWhole(assets, shown)}</span>
            <span className="font-bold text-otto-red">Debt {moneyWhole(worth.liabilities, shown)}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-otto-bg">
            <span className="block h-full rounded-full bg-otto-red" style={{ width: `${Math.min(100, debtRatio ?? 0)}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-otto-text-dim">
            {worth.liabilities > 0 ? `Debt is ${Math.round(debtRatio ?? 0)}% of assets` : "No cards or loans recorded"}
          </p>
        </div>
      )}
      <div className="mt-3 rounded-2xl bg-otto-surface px-4 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-extrabold">Deposit ladder</span>
          <span className="text-[12px] text-otto-text-dim">{weight > 0 ? `${(weighted / weight).toFixed(2)}% weighted` : "No rates yet"}</span>
        </div>
        <div className="mt-3 h-0.5 rounded-full bg-otto-amber" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[17px] font-black">{nextMaturity ? fmtLongDate(nextMaturity) : "—"}</div>
            <div className="text-[12px] text-otto-text-dim">Next maturity</div>
          </div>
          <div className="text-right">
            <div className="text-[17px] font-black">{moneyWhole(worth.deposits, shown)}</div>
            <div className="text-[12px] text-otto-text-dim">Total deposits</div>
          </div>
        </div>
        {ladder.length > 1 && (
          <div className="mt-3 space-y-2 border-t border-otto-divider pt-3">
            {ladder.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="w-20 shrink-0 font-bold">{fmtLongDate(item.maturesOn!)}</span>
                <span className="min-w-0 flex-1 truncate text-otto-text-dim">{item.nickname || item.institution}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {moneyWhole(toHome(item.principal, item.currency, shown, rate) ?? item.principal, toHome(item.principal, item.currency, shown, rate) == null ? item.currency : shown)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-otto-divider pt-3 text-[12px] leading-snug text-otto-text-dim">
          Weighted across deposits that have a rate. Not a forecast of interest.
        </p>
      </div>
    </section>
  );
}

type RangeId = "1W" | "1M" | "3M" | "All";

const RANGES: RangeId[] = ["1W", "1M", "3M", "All"];

function rangeStart(range: RangeId): string | null {
  if (range === "All") return null;
  const days = range === "1W" ? 7 : range === "1M" ? 30 : 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return todayISO(date);
}

/** Points inside the range, starting with the balance carried in from before it. */
function inRange(series: WorthPoint[], from: string | null): WorthPoint[] {
  if (!from) return series;
  const inside = series.filter((point) => point.date >= from);
  const carried = series.filter((point) => point.date < from).at(-1);
  if (!carried) return inside;
  return [{ date: from, total: carried.total }, ...inside];
}

function signedMoney(amount: number, currency: BankAccount["currency"]) {
  return `${amount > 0 ? "+" : ""}${moneyWhole(amount, currency)}`;
}

function fmtLongDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compactMoney(amount: number, currency: BankAccount["currency"]) {
  if (currency === "INR") return moneyWhole(amount, currency);
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount)}`;
}

function MilestoneCard({ milestone, currency }: { milestone: ReturnType<typeof worthMilestone>; currency: BankAccount["currency"] }) {
  const streak = milestone.weeksUp >= 2 ? `${milestone.weeksUp} weeks up` : "";
  if (!milestone.newHigh && !streak) return null;
  const title = milestone.newHigh
    ? milestone.crossed
      ? `New high · Crossed ${compactMoney(milestone.crossed, currency)}`
      : "New high"
    : "On a winning streak";
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-otto-surface px-4 py-4">
      <span className="text-[15px] font-extrabold">{title}</span>
      {streak && <span className="shrink-0 rounded-full bg-otto-green px-3 py-1 text-[12px] font-bold text-black">{streak}</span>}
    </div>
  );
}

function shareOf(amount: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((amount / total) * 100)}%`;
}

function MixRow({
  dot,
  label,
  amount,
  share,
  negative,
}: {
  dot: string;
  label: string;
  amount: string;
  share: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[14px]">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 font-semibold">{label}</span>
      <span className={`font-bold tabular-nums ${negative ? "text-otto-red" : ""}`}>{amount}</span>
      <span className="w-10 text-right text-[12px] text-otto-text-dim">{share === "out" ? "" : share}</span>
    </div>
  );
}

function AllocationBar({ slices, total }: { slices: { amount: number; dot: string }[]; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-otto-bg">
      {slices.map((part) => (
        <span key={part.dot} className={part.dot} style={{ width: `${(part.amount / total) * 100}%` }} />
      ))}
    </div>
  );
}

function ChartWaiting() {
  return (
    <div className="mt-4 flex items-center gap-2" aria-hidden>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-otto-green" />
      <span className="h-px flex-1 border-t border-dashed border-otto-divider" />
    </div>
  );
}

function linePath(points: number[], width: number, height: number, pad: number) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length === 1 ? 0 : width / (points.length - 1);
  const coords = points.map((point, index) => ({
    x: index * step,
    y: height - pad - ((point - min) / span) * (height - pad * 2),
  }));
  return {
    coords,
    d: coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "),
  };
}

function Sparkline({ points }: { points: number[] }) {
  const { d } = linePath(points, 120, 36, 4);
  return (
    <svg viewBox="0 0 120 36" className="mt-2 h-9 w-full" aria-hidden>
      <path d={d} fill="none" stroke="#3d6ea8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BalanceChart({ points, currency }: { points: WorthPoint[]; currency: BankAccount["currency"] }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 300;
  const height = 120;
  const { coords, d } = linePath(
    points.map((point) => point.total),
    width,
    height,
    10
  );
  const picked = active == null ? null : { point: points[active], at: coords[active] };
  function pick(clientX: number, box: DOMRect) {
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    setActive(Math.round(ratio * (points.length - 1)));
  }
  return (
    <div className="relative mt-4">
      {picked && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-otto-text px-2 py-1 text-[11px] font-bold text-otto-bg"
          style={{ left: `${Math.min(85, Math.max(15, (picked.at.x / width) * 100))}%` }}
        >
          {fmtDate(picked.point.date)} · {moneyWhole(picked.point.total, currency)}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-32 w-full touch-none"
        role="img"
        aria-label="Total balance by day"
        onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerDown={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
      >
        <line x1="0" x2={width} y1={height / 3} y2={height / 3} className="stroke-otto-divider" strokeWidth="1" />
        <line x1="0" x2={width} y1={(height * 2) / 3} y2={(height * 2) / 3} className="stroke-otto-divider" strokeWidth="1" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-otto-green" />
        {picked && (
          <>
            <line x1={picked.at.x} x2={picked.at.x} y1="14" y2={height} stroke="currentColor" strokeDasharray="3 3" className="text-otto-text" />
            <circle cx={picked.at.x} cy={picked.at.y} r="5" className="fill-otto-green stroke-otto-surface" strokeWidth="2" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-otto-text-dim">
        <span>{fmtDate(points[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
