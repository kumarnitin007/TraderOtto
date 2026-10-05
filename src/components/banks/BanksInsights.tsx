"use client";

import { balanceChanges, dailySeries, growthSinceStart } from "@/lib/banksHistory";
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
  const { rate, fallback } = totalsRate(accounts, deposits, prefs.inrPerUsd);
  const shown = displayCurrency(accounts, deposits, prefs.home);
  const worth = netWorth(accounts, deposits, shown, rate);
  const growth = growthSinceStart(snapshots, accounts, deposits, shown, rate);
  const series = dailySeries(snapshots, accounts, deposits, shown, rate);
  const assets = worth.cash + worth.deposits + worth.investments;
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
  const nextMaturity = openDeposits
    .map((item) => item.maturesOn)
    .filter((date): date is string => Boolean(date && date >= today))
    .sort()[0];
  const since = series[0]?.date;
  const change = growth.change;
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Performance</h1>
      {historyNote && <p className="mt-3 rounded-xl bg-otto-amber-soft px-3.5 py-3 text-[12px] text-otto-amber">{historyNote}</p>}
      <div className="mt-4 rounded-2xl bg-otto-surface px-4 py-4">
        <div className="text-[12px] text-otto-text-dim">Total balance</div>
        <div className="mt-1 text-[34px] font-black leading-none tracking-[-0.6px]">
          {worth.total == null ? "—" : moneyWhole(worth.total, shown)}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="shrink-0 rounded-full bg-otto-green-soft px-2.5 py-1 text-[12px] font-bold text-otto-green">
            {change == null ? "—" : `${change > 0 ? "+" : ""}${money(change, shown)}`}
            {since ? ` since ${fmtDate(since)}` : ""}
          </span>
          <span className="text-[12px] leading-snug text-otto-text-dim">
            {series.length > 1 ? "Saved balances over time." : "Chart starts after your next update"}
          </span>
        </div>
        {series.length > 1 ? <GrowthLine points={series.map((point) => point.total)} /> : <ChartWaiting />}
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
      <p className="mb-2 mt-5 text-[13px] font-bold">Deposits</p>
      <div className="grid grid-cols-3 gap-2">
        <StatCard value={weight > 0 ? `${(weighted / weight).toFixed(2)}%` : "—"} label="Weighted rate" />
        <StatCard value={nextMaturity ? fmtDate(nextMaturity) : "—"} label="Next maturity" />
        <StatCard value={moneyWhole(worth.deposits, shown)} label="Total" />
      </div>
      <p className="mt-2 text-[12px] leading-snug text-otto-text-dim">
        Weighted across deposits that have a rate. Not a forecast of interest.
      </p>
    </section>
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

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-otto-surface px-2 py-3 text-center">
      <div className="truncate text-[16px] font-black">{value}</div>
      <div className="mt-0.5 text-[11px] text-otto-text-dim">{label}</div>
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

function GrowthLine({ points }: { points: number[] }) {
  const width = 280;
  const height = 72;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length === 1 ? 0 : width / (points.length - 1);
  const line = points
    .map((point, index) => {
      const x = index * step;
      const y = height - ((point - min) / span) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto mt-3 h-16 w-full" role="img" aria-label="Net worth by day">
      <path d={line} fill="none" stroke="currentColor" strokeWidth="3" className="text-otto-green" />
    </svg>
  );
}
