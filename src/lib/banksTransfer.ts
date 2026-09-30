import { ACCOUNT_KIND_LABEL, countryFromCurrency, DEPOSIT_TREATMENT, money } from "@/lib/banks";
import {
  ACCOUNT_KINDS,
  DEPOSIT_KINDS,
  type AccountKind,
  type BankAccount,
  type BankAccountInput,
  type BankCurrency,
  type BankDeposit,
  type BankDepositInput,
  type DepositKind,
  type DepositPayout,
} from "@/types/bank";

export type TransferSheet = { name: string; rows: unknown[][] };

export type TransferSkip = {
  label: string;
  reason: string;
};

export type ParsedTransfer = {
  accounts: BankAccountInput[];
  deposits: BankDepositInput[];
  skipped: TransferSkip[];
};

export type ImportPlanLine = {
  label: string;
  detail: string;
};

export type ImportPlan = {
  created: ImportPlanLine[];
  updated: ImportPlanLine[];
  unchanged: ImportPlanLine[];
  skipped: TransferSkip[];
};

const ACCOUNT_HEADERS = ["type", "institution", "nickname", "owner", "currency", "balance", "last4", "nominee", "notes"] as const;
const DEPOSIT_HEADERS = ["type", "institution", "nickname", "owner", "currency", "principal", "rate", "payout", "started", "matures", "renew", "closed", "nominee", "notes"] as const;

export function ottoSheets(accounts: BankAccount[], deposits: BankDeposit[]): TransferSheet[] {
  return [
    {
      name: "Accounts",
      rows: [
        [...ACCOUNT_HEADERS],
        ...accounts.map((item) => [
          item.kind,
          item.institution,
          item.nickname,
          item.owner,
          item.currency,
          item.balance,
          item.last4,
          item.nominee,
          item.notes,
        ]),
      ],
    },
    {
      name: "Deposits",
      rows: [
        [...DEPOSIT_HEADERS],
        ...deposits.map((item) => [
          item.kind,
          item.institution,
          item.nickname,
          item.owner,
          item.currency,
          item.principal,
          item.rate ?? "",
          item.payout,
          item.startedOn ?? "",
          item.maturesOn ?? "",
          item.renew,
          item.closed ? "yes" : "no",
          item.nominee,
          item.notes,
        ]),
      ],
    },
  ];
}

export function accountMatchKey(input: Pick<BankAccountInput, "kind" | "institution" | "currency" | "last4" | "nickname">) {
  return [input.kind, input.institution.trim().toLowerCase(), input.currency, input.last4, input.nickname.trim().toLowerCase()].join("|");
}

export function depositMatchKey(input: Pick<BankDepositInput, "kind" | "institution" | "currency" | "startedOn" | "nickname">) {
  return [input.kind, input.institution.trim().toLowerCase(), input.currency, input.startedOn ?? "", input.nickname.trim().toLowerCase()].join("|");
}

export function parseBankSheets(sheets: TransferSheet[]): ParsedTransfer {
  const accounts: BankAccountInput[] = [];
  const deposits: BankDepositInput[] = [];
  const skipped: TransferSkip[] = [];
  for (const sheet of sheets) {
    const name = sheet.name.trim().toLowerCase();
    if (!/^(accounts|deposits|banks|po)$/.test(name) && !hasRecordColumn(sheet.rows)) continue;
    const parsed = parseSheet(sheet.rows, name, sheet.name);
    accounts.push(...parsed.accounts);
    deposits.push(...parsed.deposits);
    skipped.push(...parsed.skipped);
  }
  return { accounts, deposits, skipped };
}

function hasRecordColumn(rows: unknown[][]) {
  return rows.slice(0, 6).some((row) => row.some((cell) => headerKind(cell) === "record"));
}

function parseSheet(rows: unknown[][], sheetName: string, sheetTitle: string): ParsedTransfer {
  const headerIndex = rows.findIndex(
    (row, index) =>
      index < 8 &&
      row.some((cell) => {
        const kind = headerKind(cell);
        return kind === "type" || (sheetName === "po" && kind === "amount");
      })
  );
  if (headerIndex < 0) return { accounts: [], deposits: [], skipped: [] };
  const columns = new Map<string, number>();
  rows[headerIndex].forEach((cell, index) => {
    const kind = headerKind(cell);
    if (kind && !columns.has(kind)) columns.set(kind, index);
  });
  const accounts: BankAccountInput[] = [];
  const deposits: BankDepositInput[] = [];
  const skipped: TransferSkip[] = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const typeText = textAt(row, columns.get("type"));
    const record = textAt(row, columns.get("record")).toLowerCase();
    const grouped = classify(typeText, sheetName, record);
    const amount = numberAt(row, columns.get("amount"));
    const label = rowLabel(row, columns, typeText, sheetTitle, headerIndex + offset + 2);
    if (!grouped || amount == null) {
      if (!typeText && amount == null && !textAt(row, columns.get("institution"))) return;
      skipped.push({
        label,
        reason: !typeText ? "No type" : !grouped ? `Unrecognized type “${typeText}”` : "No amount",
      });
      return;
    }
    const currency = currencyAt(row, columns.get("currency"), grouped.kind);
    const institution = textAt(row, columns.get("institution")) || (sheetName === "po" ? "Post office" : "Bank");
    const owner = textAt(row, columns.get("owner"));
    const nominee = textAt(row, columns.get("nominee"));
    const notes = [textAt(row, columns.get("notes")), textAt(row, columns.get("action"))].filter(Boolean).join(" · ");
    const nickname = textAt(row, columns.get("nickname"));
    if (grouped.group === "account" && isAccountKind(grouped.kind)) {
      accounts.push({
        country: countryFromCurrency(currency),
        kind: grouped.kind,
        institution,
        nickname,
        owner,
        currency,
        balance: amount,
        last4: last4(textAt(row, columns.get("last4"))),
        nominee,
        notes,
      });
      return;
    }
    if (grouped.group === "deposit" && isDepositKind(grouped.kind)) {
      const rate = annualRate(numberAt(row, columns.get("rate")));
      const payout = payoutAt(textAt(row, columns.get("payout")), notes, grouped.kind);
      deposits.push({
        country: countryFromCurrency(currency),
        kind: grouped.kind,
        institution,
        nickname,
        owner,
        currency,
        principal: amount,
        rate,
        payout,
        startedOn: dateAt(row, columns.get("started")),
        maturesOn: dateAt(row, columns.get("matures")),
        renew: /renew/.test(`${textAt(row, columns.get("renew"))} ${notes}`.toLowerCase()) ? "auto" : "close",
        nominee,
        notes,
        closed: /^(yes|true|closed)$/i.test(textAt(row, columns.get("closed"))),
      });
      return;
    }
    skipped.push({ label, reason: "This type cannot be saved" });
  });
  return { accounts, deposits, skipped };
}

function rowLabel(row: unknown[], columns: Map<string, number>, typeText: string, sheetTitle: string, rowNumber: number) {
  const name = textAt(row, columns.get("nickname")) || textAt(row, columns.get("institution")) || textAt(row, columns.get("owner"));
  const parts = [name, typeText].filter(Boolean);
  return parts.length ? parts.join(" · ") : `${sheetTitle} row ${rowNumber}`;
}

export function planBankImport(parsed: ParsedTransfer, accounts: BankAccount[], deposits: BankDeposit[]): ImportPlan {
  const created: ImportPlanLine[] = [];
  const updated: ImportPlanLine[] = [];
  const unchanged: ImportPlanLine[] = [];
  for (const input of parsed.accounts) {
    const existing = accounts.find((item) => accountMatchKey(item) === accountMatchKey(input));
    const label = holdingLabel(input.nickname || input.institution, ACCOUNT_KIND_LABEL[input.kind], input.currency);
    if (!existing) {
      created.push({ label, detail: money(input.balance, input.currency) });
      continue;
    }
    const changes = accountChanges(existing, input);
    if (changes.length) updated.push({ label, detail: changes.join(" · ") });
    else unchanged.push({ label, detail: "Already saved" });
  }
  for (const input of parsed.deposits) {
    const existing = deposits.find((item) => depositMatchKey(item) === depositMatchKey(input));
    const label = holdingLabel(input.nickname || input.institution, DEPOSIT_TREATMENT[input.kind].label, input.currency);
    if (!existing) {
      created.push({ label, detail: money(input.principal, input.currency) });
      continue;
    }
    const changes = depositChanges(existing, input);
    if (changes.length) updated.push({ label, detail: changes.join(" · ") });
    else unchanged.push({ label, detail: "Already saved" });
  }
  return { created, updated, unchanged, skipped: parsed.skipped };
}

function holdingLabel(name: string, kind: string, currency: string) {
  return `${name} · ${kind} · ${currency}`;
}

function accountChanges(existing: BankAccount, input: BankAccountInput) {
  const changes: string[] = [];
  if (existing.balance !== input.balance) changes.push(`Balance ${money(existing.balance, existing.currency)} → ${money(input.balance, input.currency)}`);
  if (existing.currency !== input.currency) changes.push(`Currency ${existing.currency} → ${input.currency}`);
  if (existing.owner !== input.owner) changes.push("Owner");
  if (existing.nominee !== input.nominee) changes.push("Nominee");
  if (existing.notes !== input.notes) changes.push("Notes");
  return changes;
}

function depositChanges(existing: BankDeposit, input: BankDepositInput) {
  const changes: string[] = [];
  if (existing.principal !== input.principal) changes.push(`Principal ${money(existing.principal, existing.currency)} → ${money(input.principal, input.currency)}`);
  if (existing.currency !== input.currency) changes.push(`Currency ${existing.currency} → ${input.currency}`);
  if (existing.rate !== input.rate) changes.push(`Rate ${existing.rate ?? "—"}% → ${input.rate ?? "—"}%`);
  if (existing.maturesOn !== input.maturesOn) changes.push("Maturity date");
  if (existing.closed !== input.closed) changes.push(input.closed ? "Marked closed" : "Marked open");
  return changes;
}

function headerKind(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (text === "type") return "type";
  if (text === "record") return "record";
  if (text === "currency") return "currency";
  if (text === "institution" || text === "bank" || text === "source") return "institution";
  if (text === "nickname") return "nickname";
  if (text === "owner" || text === "account owner") return "owner";
  if (text === "nominee") return "nominee";
  if (text === "roi" || text === "apr" || text === "interest" || text === "rate") return "rate";
  if (text === "amount" || text === "balance" || text === "balance ampount" || text === "deposit" || text === "principal") return "amount";
  if (text === "start date" || text === "start" || text === "started") return "started";
  if (text === "maturity date" || text === "matures" || text === "maturity") return "matures";
  if (text === "payout") return "payout";
  if (text === "renew" || text === "at maturity") return "renew";
  if (text === "closed") return "closed";
  if (text === "last4" || text === "last 4" || text === "account number") return "last4";
  if (text === "notes" || text === "note" || text === "next action") return notesOrAction(text);
  return null;
}

function notesOrAction(text: string) {
  return text === "next action" ? "action" : "notes";
}

function classify(typeText: string, sheetName: string, record: string): { group: "account" | "deposit"; kind: AccountKind | DepositKind } | null {
  const text = typeText.trim().toLowerCase();
  const kind = kindFromLabel(text);
  if (record === "account" && kind && isAccountKind(kind)) return { group: "account", kind };
  if (record === "deposit" && kind && isDepositKind(kind)) return { group: "deposit", kind };
  if (kind && isAccountKind(kind)) return { group: "account", kind };
  if (kind && isDepositKind(kind)) return { group: "deposit", kind };
  if (!text && sheetName === "po") return { group: "deposit", kind: "po" };
  return null;
}

function kindFromLabel(text: string): AccountKind | DepositKind | null {
  if (/401|trading|broker/.test(text)) return "trading";
  if (/check/.test(text)) return "checking";
  if (/sav/.test(text)) return "savings";
  if (/card|credit/.test(text)) return "card";
  if (/loan/.test(text)) return "loan";
  if (text === "cd" || /certificate/.test(text)) return "cd";
  if (text === "fd" || /fixed/.test(text)) return "fd";
  if (text === "rd" || /recurring/.test(text)) return "rd";
  if (text === "ppf") return "ppf";
  if (text === "scss") return "scss";
  if (text === "po" || /post office/.test(text)) return "po";
  if (text === "other") return "other";
  return null;
}

function isAccountKind(kind: string): kind is AccountKind {
  return (ACCOUNT_KINDS as readonly string[]).includes(kind);
}

function isDepositKind(kind: string): kind is DepositKind {
  return (DEPOSIT_KINDS as readonly string[]).includes(kind);
}

function textAt(row: unknown[], index: number | undefined) {
  if (index == null) return "";
  const value = row[index];
  if (value == null) return "";
  return String(value).trim();
}

function numberAt(row: unknown[], index: number | undefined) {
  if (index == null) return null;
  const value = row[index];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,₹\s,]/g, ""));
  return Number.isFinite(parsed) && value.trim() ? parsed : null;
}

function currencyAt(row: unknown[], index: number | undefined, kind: string): BankCurrency {
  const text = textAt(row, index).toUpperCase();
  if (text.includes("INR") || text.includes("RUPEE")) return "INR";
  if (text.includes("USD") || text.includes("DOLLAR")) return "USD";
  return kind === "fd" || kind === "rd" || kind === "ppf" || kind === "scss" || kind === "po" ? "INR" : "USD";
}

function annualRate(value: number | null) {
  if (value == null) return null;
  if (value > 0 && value < 1) return Math.round(value * 10000) / 100;
  return value;
}

function payoutAt(explicit: string, notes: string, kind: DepositKind): DepositPayout {
  const blob = `${explicit} ${notes}`.toLowerCase();
  if (/quarter/.test(blob)) return "quarterly";
  if (/month/.test(blob)) return "monthly";
  if (/matur/.test(explicit.toLowerCase())) return "maturity";
  return DEPOSIT_TREATMENT[kind].defaultPayout;
}

function dateAt(row: unknown[], index: number | undefined) {
  if (index == null) return null;
  return asDate(row[index]);
}

export function asDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!slash) return null;
  let year = Number(slash[3]);
  if (year < 100) year += 2000;
  let month = Number(slash[1]);
  let day = Number(slash[2]);
  if (month > 12) {
    const swap = month;
    month = day;
    day = swap;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function last4(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-4);
}
