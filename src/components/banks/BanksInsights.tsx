"use client";

import { balanceChanges, dailySeries, growthSinceStart } from "@/lib/banksHistory";
import { bankFocus, displayCurrency, money, netWorth } from "@/lib/banks";
import { fmtDate } from "@/lib/pnl";
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
}: {
  accounts: BankAccount[];
  deposits: BankDeposit[];
  snapshots: BankSnapshot[];
  prefs: BanksPreferences;
  historyNote: string;
}) {
  const shown = displayCurrency(accounts, deposits, prefs.home);
  const worth = netWorth(accounts, deposits, shown, prefs.inrPerUsd);
  const growth = growthSinceStart(snapshots, accounts, deposits, shown, prefs.inrPerUsd);
  const series = dailySeries(snapshots, accounts, deposits, shown, prefs.inrPerUsd);
  const parts = [
    { label: "Cash", amount: worth.cash },
    { label: "Deposits", amount: worth.deposits },
    { label: "Trading", amount: worth.investments },
    { label: "Owed", amount: worth.liabilities },
  ];
  const rated = deposits.filter((item) => !item.closed && item.rate != null && item.principal > 0);
  const weighted = rated.reduce((sum, item) => sum + item.principal * (item.rate ?? 0), 0);
  const principal = rated.reduce((sum, item) => sum + item.principal, 0);
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Performance</h1>
      {historyNote && <p className="mt-3 rounded-xl bg-otto-amber-soft px-3.5 py-3 text-[12px] text-otto-amber">{historyNote}</p>}
      <div className="mt-4 rounded-2xl bg-otto-surface px-4 py-4 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Since tracking started</div>
        <div className="mt-1 text-[28px] font-black">
          {growth.change == null ? "—" : `${growth.change > 0 ? "+" : ""}${money(growth.change, shown)}`}
        </div>
        <p className="mt-1 text-[12px] text-otto-text-dim">
          {growth.change == null
            ? "Set the exchange rate in Settings to combine both currencies."
            : growth.change === 0
              ? "Today’s balances are the baseline. The total moves after an amount changes."
              : "Change from the first saved balance of each holding."}
        </p>
        {series.length > 1 && <GrowthLine points={series.map((point) => point.total)} />}
      </div>
      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Mix</p>
      <div className="space-y-2">
        {parts.map((part) => (
          <div key={part.label} className="flex items-center justify-between rounded-2xl bg-otto-surface px-4 py-3">
            <span className="text-[14px] font-bold">{part.label}</span>
            <span className="text-[14px] font-bold">{worth.total == null ? "—" : money(part.amount, shown)}</span>
          </div>
        ))}
      </div>
      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Deposits</p>
      <div className="rounded-2xl bg-otto-surface px-4 py-3">
        <div className="text-[14px] font-bold">{principal > 0 ? `${(weighted / principal).toFixed(2)}%` : "—"}</div>
        <p className="mt-0.5 text-[12px] text-otto-text-dim">Weighted rate on deposits that have a rate. This is not a forecast of interest paid.</p>
      </div>
    </section>
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
