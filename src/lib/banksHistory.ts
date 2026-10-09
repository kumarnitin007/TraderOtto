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

export type HoldingBucket = "cash" | "deposits" | "investments" | "liabilities";

export type BucketChanges = Record<HoldingBucket, number> & {
  total: number;
  start: Record<HoldingBucket, number>;
};

export type WorthMilestone = {
  newHigh: boolean;
  crossed: number | null;
  weeksUp: number;
};

function openHoldings(accounts: BankAccount[], deposits: BankDeposit[]) {
  return [
    ...accounts.map((item) => ({
      kind: "account" as const,
      id: item.id,
      title: item.nickname || item.institution,
      amount: item.balance,
      currency: item.currency,
      bucket: accountBucket(item.kind) as HoldingBucket,
      liability: accountBucket(item.kind) === "liabilities",
    })),
    ...deposits.filter((item) => !item.closed).map((item) => ({
      kind: "deposit" as const,
      id: item.id,
      title: item.nickname || item.institution,
      amount: item.principal,
      currency: item.currency,
      bucket: "deposits" as HoldingBucket,
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
  inrPerUsd: number | null,
  bucket?: HoldingBucket
): WorthPoint[] {
  const holdings = openHoldings(accounts, deposits).filter((holding) => !bucket || holding.bucket === bucket);
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

/** Each holding is measured from its balance on `from`, or from its first saved balance if it started later. */
export function bucketChanges(
  snapshots: BankSnapshot[],
  accounts: BankAccount[],
  deposits: BankDeposit[],
  home: BankCurrency,
  inrPerUsd: number | null,
  from: string | null
): BucketChanges | null {
  const empty = () => ({ cash: 0, deposits: 0, investments: 0, liabilities: 0 });
  const change = empty();
  const start = empty();
  for (const holding of openHoldings(accounts, deposits)) {
    const events = eventsFor(snapshots, holding.kind, holding.id);
    if (!events.length) continue;
    const before = from ? events.filter((item) => item.recordedOn <= from).at(-1) : undefined;
    const first = before ?? events[0];
    const latest = events[events.length - 1];
    const fromValue = toHome(signed(first.amount, holding.liability), first.currency, home, inrPerUsd);
    const toValue = toHome(signed(latest.amount, holding.liability), latest.currency, home, inrPerUsd);
    if (fromValue == null || toValue == null) return null;
    change[holding.bucket] += toValue - fromValue;
    start[holding.bucket] += fromValue;
  }
  return {
    ...change,
    total: change.cash + change.deposits + change.investments + change.liabilities,
    start,
  };
}

const MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];

export function worthMilestone(points: WorthPoint[]): WorthMilestone {
  if (points.length < 2) return { newHigh: false, crossed: null, weeksUp: 0 };
  const latest = points[points.length - 1].total;
  const priorHigh = Math.max(...points.slice(0, -1).map((point) => point.total));
  const newHigh = latest > priorHigh;
  const crossed = newHigh ? MILESTONES.filter((mark) => priorHigh < mark && latest >= mark).at(-1) ?? null : null;
  return { newHigh, crossed, weeksUp: weeksUp(points) };
}

function weeksUp(points: WorthPoint[]) {
  const weekly = new Map<string, number>();
  for (const point of points) weekly.set(weekKey(point.date), point.total);
  const closes = [...weekly.values()];
  let count = 0;
  for (let index = closes.length - 1; index > 0; index -= 1) {
    if (closes[index] <= closes[index - 1]) break;
    count += 1;
  }
  return count;
}

function weekKey(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
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
