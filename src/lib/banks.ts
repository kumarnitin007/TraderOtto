import type {
  AccountKind,
  BankAccount,
  BankCurrency,
  BankDeposit,
  BankCountry,
  DepositKind,
  DepositPayout,
  DepositRenew,
} from "@/types/bank";

export const COUNTRY_LABEL: Record<BankCountry, string> = {
  us: "United States",
  in: "India",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Checking",
  savings: "Savings",
  trading: "Trading",
  card: "Credit card",
  loan: "Loan",
};

export function accountBucket(kind: AccountKind): "cash" | "investments" | "liabilities" {
  if (kind === "trading") return "investments";
  if (kind === "card" || kind === "loan") return "liabilities";
  return "cash";
}

export function toHome(
  amount: number,
  currency: BankCurrency,
  home: BankCurrency,
  inrPerUsd: number | null
): number | null {
  if (currency === home) return amount;
  if (!inrPerUsd || inrPerUsd <= 0) return null;
  if (currency === "INR" && home === "USD") return amount / inrPerUsd;
  return amount * inrPerUsd;
}

export function money(amount: number, currency: BankCurrency) {
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return currency === "INR" ? `${sign}₹${formatted}` : `${sign}$${formatted}`;
}

export type WorthBuckets = {
  cash: number;
  deposits: number;
  investments: number;
  liabilities: number;
  total: number | null;
  unconverted: number;
};

export function netWorth(
  accounts: BankAccount[],
  deposits: BankDeposit[],
  home: BankCurrency,
  inrPerUsd: number | null
): WorthBuckets {
  const buckets: WorthBuckets = {
    cash: 0,
    deposits: 0,
    investments: 0,
    liabilities: 0,
    total: 0,
    unconverted: 0,
  };
  function add(bucket: "cash" | "deposits" | "investments" | "liabilities", amount: number, currency: BankCurrency) {
    const converted = toHome(amount, currency, home, inrPerUsd);
    if (converted == null) {
      buckets.unconverted += 1;
      buckets.total = null;
      return;
    }
    buckets[bucket] += converted;
  }
  for (const account of accounts) add(accountBucket(account.kind), account.balance, account.currency);
  for (const deposit of deposits) {
    if (!deposit.closed) add("deposits", deposit.principal, deposit.currency);
  }
  if (buckets.total != null) {
    buckets.total = buckets.cash + buckets.deposits + buckets.investments - buckets.liabilities;
  }
  return buckets;
}

export function countryFromCurrency(currency: BankCurrency): BankCountry {
  return currency === "INR" ? "in" : "us";
}

/** Currencies on open money. A closed deposit does not keep the second currency on screen. */
export function activeCurrencies(accounts: BankAccount[], deposits: BankDeposit[]): BankCurrency[] {
  const found = new Set<BankCurrency>();
  for (const account of accounts) found.add(account.currency);
  for (const deposit of deposits) {
    if (!deposit.closed) found.add(deposit.currency);
  }
  return (["USD", "INR"] as const).filter((currency) => found.has(currency));
}

export function usesMultipleCurrencies(accounts: BankAccount[], deposits: BankDeposit[]) {
  return activeCurrencies(accounts, deposits).length > 1;
}

/** One currency in the books: show that. None or both: show the preferred currency. */
export function displayCurrency(
  accounts: BankAccount[],
  deposits: BankDeposit[],
  home: BankCurrency
): BankCurrency {
  const currencies = activeCurrencies(accounts, deposits);
  return currencies.length === 1 ? currencies[0] : home;
}

export const DEPOSIT_TREATMENT: Record<
  DepositKind,
  { label: string; lockIn: string; defaultPayout: DepositPayout }
> = {
  cd: {
    label: "CD",
    lockIn: "Early withdrawal usually costs a few months of interest.",
    defaultPayout: "maturity",
  },
  fd: {
    label: "Fixed deposit",
    lockIn: "You can usually close early at a lower rate. A 5-year tax-saver FD stays locked for the term.",
    defaultPayout: "maturity",
  },
  rd: {
    label: "Recurring",
    lockIn: "Locked for the installment term. Early closure often has a penalty.",
    defaultPayout: "maturity",
  },
  ppf: {
    label: "PPF",
    lockIn: "Locked for 15 years. Partial withdrawal from year 7. Extension is in 5-year blocks.",
    defaultPayout: "maturity",
  },
  scss: {
    label: "SCSS",
    lockIn: "Locked for 5 years, then one 3-year extension. Interest is paid every quarter.",
    defaultPayout: "quarterly",
  },
  po: {
    label: "Post office",
    lockIn: "NSC and time deposits run to maturity. A monthly income scheme pays each month, so set payout to match.",
    defaultPayout: "maturity",
  },
  other: {
    label: "Other",
    lockIn: "Use the maturity date and payout to say what happens next.",
    defaultPayout: "maturity",
  },
};

export function maturityOutlook(kind: DepositKind, renew: DepositRenew) {
  if (kind === "ppf") {
    return renew === "auto"
      ? "Extends in a 5-year block unless you close it."
      : "Closes unless you extend it for 5 years.";
  }
  if (kind === "scss") {
    return renew === "auto"
      ? "Extends for 3 years unless you close it."
      : "Closes unless you take the 3-year extension.";
  }
  if (renew === "auto") return "Renews for another term unless you stop it.";
  return "Money comes back unless you renew it.";
}

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addMonths(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const shifted = new Date(year, month - 1 + months, 1);
  const last = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  return isoDate(new Date(shifted.getFullYear(), shifted.getMonth(), Math.min(day, last)));
}

/** Next interest date after today. Maturity payout is the maturity row, not a separate interest row. */
export function nextPayoutOn(deposit: Pick<BankDeposit, "closed" | "payout" | "startedOn" | "maturesOn">, today = new Date()) {
  if (deposit.closed || deposit.payout === "maturity" || !deposit.startedOn) return null;
  const step = deposit.payout === "monthly" ? 1 : 3;
  const todayIso = isoDate(today);
  for (let index = 1; index <= 240; index += 1) {
    const cursor = addMonths(deposit.startedOn, step * index);
    if (deposit.maturesOn && cursor > deposit.maturesOn) return null;
    if (cursor >= todayIso) return cursor;
  }
  return null;
}

function nextPpfCredit(today: Date) {
  const year = today.getMonth() < 2 || (today.getMonth() === 2 && today.getDate() <= 31) ? today.getFullYear() : today.getFullYear() + 1;
  return `${year}-03-31`;
}

export type BankFocus = {
  id: string;
  depositId: string;
  title: string;
  detail: string;
  days: number;
};

const MATURITY_HORIZON = 45;
const PAYOUT_HORIZON = 21;

export function depositWhen(deposit: BankDeposit, today = new Date()) {
  if (deposit.closed) return "Closed";
  const days = daysUntil(deposit.maturesOn, today);
  if (days == null) return DEPOSIT_TREATMENT[deposit.kind].label;
  if (days < 0) return `Matured ${Math.abs(days)}d ago`;
  if (days === 0) return "Matures today";
  return `${deposit.renew === "auto" ? "Renews" : "Matures"} in ${days}d`;
}

export function bankFocus(deposits: BankDeposit[], today = new Date()): BankFocus[] {
  const items: BankFocus[] = [];
  for (const deposit of deposits) {
    if (deposit.closed) continue;
    const name = deposit.nickname || deposit.institution || DEPOSIT_TREATMENT[deposit.kind].label;
    const kind = DEPOSIT_TREATMENT[deposit.kind].label;
    const days = daysUntil(deposit.maturesOn, today);
    if (days != null && days <= MATURITY_HORIZON) {
      const when =
        days < 0
          ? `Matured ${Math.abs(days)}d ago · still open`
          : days === 0
            ? `Matures today · ${maturityOutlook(deposit.kind, deposit.renew)}`
            : `${deposit.renew === "auto" ? "Renews" : "Closes"} in ${days}d · ${maturityOutlook(deposit.kind, deposit.renew)}`;
      items.push({
        id: `${deposit.id}:maturity`,
        depositId: deposit.id,
        title: name,
        detail: `${kind} · ${when}`,
        days,
      });
    }
    const payoutOn = nextPayoutOn(deposit, today);
    const payoutDays = daysUntil(payoutOn, today);
    if (payoutDays != null && payoutDays <= PAYOUT_HORIZON && (days == null || payoutDays < days)) {
      const when = payoutDays === 0 ? "today" : `in ${payoutDays}d`;
      items.push({
        id: `${deposit.id}:payout`,
        depositId: deposit.id,
        title: name,
        detail: `${kind} · ${deposit.payout === "monthly" ? "Monthly" : "Quarterly"} interest ${when}`,
        days: payoutDays,
      });
    }
    if (deposit.kind === "ppf") {
      const credit = nextPpfCredit(today);
      const creditDays = daysUntil(credit, today);
      if (creditDays != null && creditDays <= MATURITY_HORIZON && (days == null || creditDays < days)) {
        items.push({
          id: `${deposit.id}:ppf-credit`,
          depositId: deposit.id,
          title: name,
          detail: `${kind} · Interest credits ${creditDays === 0 ? "today" : `in ${creditDays}d`}`,
          days: creditDays,
        });
      }
    }
  }
  return items.sort((left, right) => left.days - right.days || left.title.localeCompare(right.title));
}

export function nativeTotal(accounts: BankAccount[], deposits: BankDeposit[], currency: BankCurrency) {
  let total = 0;
  for (const account of accounts) {
    if (account.currency !== currency) continue;
    total += accountBucket(account.kind) === "liabilities" ? -account.balance : account.balance;
  }
  for (const deposit of deposits) {
    if (deposit.closed || deposit.currency !== currency) continue;
    total += deposit.principal;
  }
  return total;
}

export function daysUntil(iso: string | null, today = new Date()) {
  if (!iso) return null;
  const due = new Date(`${iso}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

export function depositProgress(deposit: Pick<BankDeposit, "startedOn" | "maturesOn">, today = new Date()) {
  if (!deposit.startedOn || !deposit.maturesOn) return null;
  const start = new Date(`${deposit.startedOn}T00:00:00`).getTime();
  const end = new Date(`${deposit.maturesOn}T00:00:00`).getTime();
  if (end <= start) return null;
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
