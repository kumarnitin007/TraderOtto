import { accountBucket, toHome } from "@/lib/banks";
import type { BankAccount, BankCurrency, BankDeposit, BankSnapshot } from "@/types/bank";

export type WorthPoint = { date: string; total: number };

export type BalanceChange = {
  holdingKind: "account" | "deposit";
  holdingId: string;
  title: string;
  currency: BankCurrency;
  before: number;
  after: number;
  recordedOn: string;
};

function openHoldings(accounts: BankAccount[], deposits: BankDeposit[]) {
  return [
    ...accounts.map((item) => ({
      kind: "account" as const,
      id: item.id,
      title: item.nickname || item.institution,
      amount: item.balance,
      currency: item.currency,
      liability: accountBucket(item.kind) === "liabilities",
    })),
    ...deposits.filter((item) => !item.closed).map((item) => ({
      kind: "deposit" as const,
      id: item.id,
      title: item.nickname || item.institution,
      amount: item.principal,
      currency: item.currency,
      liability: false,
    })),
  ];
}

function eventsFor(snapshots: BankSnapshot[], kind: string, id: string) {
  return snapshots
    .filter((item) => item.holdingKind === kind && item.holdingId === id)
    .sort((left, right) => left.recordedOn.localeCompare(right.recordedOn) || left.createdAt.localeCompare(right.createdAt));
}

function signed(amount: number, liability: boolean) {
  return liability ? -Math.abs(amount) : amount;
}

export function growthSinceStart(
  snapshots: BankSnapshot[],
  accounts: BankAccount[],
  deposits: BankDeposit[],
  home: BankCurrency,
  inrPerUsd: number | null
) {
  const holdings = openHoldings(accounts, deposits);
  let start = 0;
  let end = 0;
  let comparable = false;
  let missing = false;
  for (const holding of holdings) {
    const events = eventsFor(snapshots, holding.kind, holding.id);
    const first = events[0];
    const latest = events[events.length - 1];
    if (!first || !latest) continue;
    const from = toHome(signed(first.amount, holding.liability), first.currency, home, inrPerUsd);
    const to = toHome(signed(latest.amount, holding.liability), latest.currency, home, inrPerUsd);
    if (from == null || to == null) {
      missing = true;
      break;
    }
    start += from;
    end += to;
    if (events.length > 1 && first.amount !== latest.amount) comparable = true;
  }
  if (missing) return { change: null, start: null, end: null };
  return { change: comparable ? end - start : 0, start, end };
}

export function dailySeries(
  snapshots: BankSnapshot[],
  accounts: BankAccount[],
  deposits: BankDeposit[],
  home: BankCurrency,
  inrPerUsd: number | null
): WorthPoint[] {
  const holdings = openHoldings(accounts, deposits);
  const dates = [...new Set(snapshots.map((item) => item.recordedOn))].sort();
  const points: WorthPoint[] = [];
  for (const date of dates) {
    let total = 0;
    let any = false;
    let missing = false;
    for (const holding of holdings) {
      const events = eventsFor(snapshots, holding.kind, holding.id).filter((item) => item.recordedOn <= date);
      const latest = events[events.length - 1];
      if (!latest) continue;
      const value = toHome(signed(latest.amount, holding.liability), latest.currency, home, inrPerUsd);
      if (value == null) {
        missing = true;
        continue;
      }
      total += value;
      any = true;
    }
    if (any && !missing) points.push({ date, total });
  }
  return points;
}

export function balanceChanges(
  snapshots: BankSnapshot[],
  accounts: BankAccount[],
  deposits: BankDeposit[]
): BalanceChange[] {
  const changes: BalanceChange[] = [];
  for (const holding of openHoldings(accounts, deposits)) {
    const events = eventsFor(snapshots, holding.kind, holding.id);
    const latest = events[events.length - 1];
    const previous = [...events].reverse().find((item) => item !== latest && item.amount !== latest?.amount);
    if (!latest || !previous) continue;
    changes.push({
      holdingKind: holding.kind,
      holdingId: holding.id,
      title: holding.title,
      currency: latest.currency,
      before: previous.amount,
      after: latest.amount,
      recordedOn: latest.recordedOn,
    });
  }
  return changes.sort((left, right) => right.recordedOn.localeCompare(left.recordedOn) || left.title.localeCompare(right.title));
}

export function rowsNeedingSnapshot(
  snapshots: BankSnapshot[],
  accounts: BankAccount[],
  deposits: BankDeposit[],
  recordedOn: string
) {
  return snapshotRows(accounts, deposits, recordedOn).filter((row) => {
    const latest = snapshots
      .filter((item) => item.holdingKind === row.holdingKind && item.holdingId === row.holdingId)
      .sort((left, right) => left.recordedOn.localeCompare(right.recordedOn) || left.createdAt.localeCompare(right.createdAt))
      .at(-1);
    return !latest || latest.amount !== row.amount || latest.currency !== row.currency;
  });
}

export function snapshotRows(accounts: BankAccount[], deposits: BankDeposit[], recordedOn: string) {
  return [
    ...accounts.map((item) => ({
      holdingKind: "account" as const,
      holdingId: item.id,
      amount: item.balance,
      currency: item.currency,
      recordedOn,
    })),
    ...deposits.map((item) => ({
      holdingKind: "deposit" as const,
      holdingId: item.id,
      amount: item.principal,
      currency: item.currency,
      recordedOn,
    })),
  ];
}
