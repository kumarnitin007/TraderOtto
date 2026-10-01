"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  Check,
  Download,
  Import,
  Landmark,
  Maximize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Upload,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { BanksActivity, BanksPerformance } from "@/components/banks/BanksInsights";
import { SectionPreferences } from "@/components/settings/SectionPreferences";
import { SettingsDetailScreen, SettingsRow } from "@/components/settings/SettingsPrimitives";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferNotice,
} from "@/components/settings/DataTransferPrimitives";
import { ActionSheet, SheetAction } from "@/components/ui/ActionSheet";
import { useBanks } from "@/hooks/useBanks";
import { useScreenOption } from "@/hooks/useScreenOption";
import {
  ACCOUNT_KIND_LABEL,
  DEPOSIT_TREATMENT,
  accountBucket,
  bankFocus,
  countryFromCurrency,
  daysUntil,
  depositReference,
  depositWhen,
  displayCurrency,
  HOLDING_SORTS,
  maturityOutlook,
  money,
  moneyWhole,
  nativeTotal,
  netWorth,
  notesWithDepositReference,
  sortHoldings,
  toHome,
  usesMultipleCurrencies,
  type HoldingSort,
  type WorthBuckets,
} from "@/lib/banks";
import { readBanksPreferences, writeBanksPreferences, type BanksPreferences } from "@/lib/banksPreferences";
import { accountMatchKey, depositMatchKey, ottoSheets, parseBankSheets, planBankImport, type ParsedTransfer } from "@/lib/banksTransfer";
import { fmtDate } from "@/lib/pnl";
import {
  ACCOUNT_KINDS,
  BANK_CURRENCIES,
  DEPOSIT_KINDS,
  DEPOSIT_PAYOUTS,
  DEPOSIT_RENEWS,
  type BankAccount,
  type BankAccountInput,
  type BankCurrency,
  type BankDeposit,
  type BankDepositInput,
  type DepositPayout,
  type DepositRenew,
} from "@/types/bank";

type BanksTab = "overview" | "holdings" | "activity" | "performance" | "settings";
type HoldingRef = { kind: "account"; id: string } | { kind: "deposit"; id: string };
type EditorState = { kind: "account" | "deposit"; id?: string };

const TABS: { id: BanksTab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: Wallet },
  { id: "holdings", label: "Holdings", icon: Landmark },
  { id: "activity", label: "Activity", icon: Bell },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const PAYOUT_LABEL: Record<DepositPayout, string> = {
  maturity: "At maturity",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const RENEW_LABEL: Record<DepositRenew, string> = {
  close: "Close at maturity",
  auto: "Auto renew",
};

const EMPTY_ACCOUNT: BankAccountInput = {
  country: "us",
  kind: "checking",
  institution: "",
  nickname: "",
  owner: "",
  currency: "USD",
  balance: 0,
  last4: "",
  nominee: "",
  notes: "",
};

const EMPTY_DEPOSIT: BankDepositInput = {
  country: "in",
  kind: "fd",
  institution: "",
  nickname: "",
  owner: "",
  currency: "INR",
  principal: 0,
  rate: null,
  payout: "maturity",
  startedOn: null,
  maturesOn: null,
  renew: "close",
  nominee: "",
  notes: "",
  closed: false,
};

export function BanksWorkspace() {
  const banks = useBanks();
  const [tab, setTab] = useScreenOption("banksTab");
  const [prefs, setPrefs] = useState<BanksPreferences>(readBanksPreferences);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [sheet, setSheet] = useState<HoldingRef | null>(null);
  const [detail, setDetail] = useState<HoldingRef | null>(null);
  const [notice, setNotice] = useState("");
  const multi = usesMultipleCurrencies(banks.accounts, banks.deposits);
  const entryCurrency = displayCurrency(banks.accounts, banks.deposits, prefs.home);

  function savePrefs(next: BanksPreferences) {
    setPrefs(next);
    writeBanksPreferences(next);
  }

  function openDetail(ref: HoldingRef) {
    setSheet(null);
    setDetail(ref);
  }

  function openEditor(next: EditorState) {
    setSheet(null);
    setDetail(null);
    setEditor(next);
  }

  async function onSaveAccount(input: BankAccountInput) {
    setNotice("");
    try {
      await banks.saveAccount(input, editor?.kind === "account" ? editor.id : undefined);
      setEditor(null);
      setTab("holdings");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not save this account.");
    }
  }

  async function onSaveDeposit(input: BankDepositInput) {
    setNotice("");
    try {
      await banks.saveDeposit(input, editor?.kind === "deposit" ? editor.id : undefined);
      setEditor(null);
      setTab("holdings");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not save this deposit.");
    }
  }

  const sheetAccount = sheet?.kind === "account" ? banks.accounts.find((item) => item.id === sheet.id) : undefined;
  const sheetDeposit = sheet?.kind === "deposit" ? banks.deposits.find((item) => item.id === sheet.id) : undefined;
  const detailAccount = detail?.kind === "account" ? banks.accounts.find((item) => item.id === detail.id) : undefined;
  const detailDeposit = detail?.kind === "deposit" ? banks.deposits.find((item) => item.id === detail.id) : undefined;
  const editingAccount = editor?.kind === "account" && editor.id ? banks.accounts.find((item) => item.id === editor.id) ?? null : null;
  const editingDeposit = editor?.kind === "deposit" && editor.id ? banks.deposits.find((item) => item.id === editor.id) ?? null : null;

  return (
    <div className="mx-auto max-w-[720px] pb-28">
      {banks.error && <p className="mb-3 rounded-xl bg-otto-red-soft px-3.5 py-3 text-[12px] text-otto-red">{banks.error}</p>}
      {notice && <p className="mb-3 rounded-xl bg-otto-red-soft px-3.5 py-3 text-[12px] text-otto-red">{notice}</p>}
      {tab === "overview" && (
        <Overview
          accounts={banks.accounts}
          deposits={banks.deposits}
          prefs={prefs}
          loading={banks.loading}
          onAdd={() => openEditor({ kind: "account" })}
          onOpenDeposit={(id) => openDetail({ kind: "deposit", id })}
        />
      )}
      {tab === "holdings" && (
        <Holdings
          accounts={banks.accounts}
          deposits={banks.deposits}
          prefs={prefs}
          loading={banks.loading}
          onAdd={() => openEditor({ kind: "account" })}
          onOpenAccount={(id) => setSheet({ kind: "account", id })}
          onOpenDeposit={(id) => setSheet({ kind: "deposit", id })}
        />
      )}
      {tab === "activity" && (
        <BanksActivity
          accounts={banks.accounts}
          deposits={banks.deposits}
          snapshots={banks.snapshots}
          loading={banks.loading}
          onOpenDeposit={(id) => openDetail({ kind: "deposit", id })}
        />
      )}
      {tab === "performance" && (
        <BanksPerformance
          accounts={banks.accounts}
          deposits={banks.deposits}
          snapshots={banks.snapshots}
          prefs={prefs}
          historyNote={banks.historyNote}
        />
      )}
      {tab === "settings" && (
        <BanksSettings
          prefs={prefs}
          multi={multi}
          accounts={banks.accounts}
          deposits={banks.deposits}
          readonly={banks.readonly}
          onPrefs={savePrefs}
          onClear={() => banks.clearAll()}
          onImport={async (parsed) => {
            for (const account of parsed.accounts) {
              const existing = banks.accounts.find((item) => accountMatchKey(item) === accountMatchKey(account));
              await banks.saveAccount(account, existing?.id);
            }
            for (const deposit of parsed.deposits) {
              const existing = banks.deposits.find((item) => depositMatchKey(item) === depositMatchKey(deposit));
              await banks.saveDeposit(deposit, existing?.id);
            }
          }}
        />
      )}
      <nav
        aria-label="Banks navigation"
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-otto-divider bg-otto-bg/90 px-1 pb-[calc(9px+env(safe-area-inset-bottom))] pt-[9px] backdrop-blur-[14px] desk:static desk:mt-8 desk:rounded-2xl desk:border desk:bg-otto-surface desk:pb-2"
      >
        <div className="mx-auto flex max-w-[720px]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 flex-col items-center gap-[3px] px-0 pb-1 pt-1.5 ${
                tab === id ? "text-otto-green" : "text-otto-text-faint"
              }`}
            >
              <Icon size={20} strokeWidth={tab === id ? 2.3 : 1.8} />
              <small className="text-[10px] font-semibold">{label}</small>
            </button>
          ))}
        </div>
      </nav>

      {sheetAccount && (
        <ActionSheet
          title={sheetAccount.nickname || sheetAccount.institution}
          subtitle={`${ACCOUNT_KIND_LABEL[sheetAccount.kind]} · ${sheetAccount.currency} · ${money(sheetAccount.balance, sheetAccount.currency)}`}
          icon={Landmark}
          onClose={() => setSheet(null)}
        >
          <SheetAction icon={Maximize2} label="View" onClick={() => openDetail({ kind: "account", id: sheetAccount.id })} />
          <SheetAction icon={Pencil} label="Edit" onClick={() => openEditor({ kind: "account", id: sheetAccount.id })} />
          <SheetAction
            icon={Trash2}
            label="Remove"
            tone="danger"
            onClick={() => {
              void banks.removeAccount(sheetAccount.id);
              setSheet(null);
            }}
          />
        </ActionSheet>
      )}
      {sheetDeposit && (
        <ActionSheet
          title={sheetDeposit.nickname || sheetDeposit.institution}
          subtitle={`${DEPOSIT_TREATMENT[sheetDeposit.kind].label} · ${sheetDeposit.currency} · ${money(sheetDeposit.principal, sheetDeposit.currency)}`}
          icon={Landmark}
          onClose={() => setSheet(null)}
        >
          <SheetAction icon={Maximize2} label="View" onClick={() => openDetail({ kind: "deposit", id: sheetDeposit.id })} />
          <SheetAction icon={Pencil} label="Edit" onClick={() => openEditor({ kind: "deposit", id: sheetDeposit.id })} />
          <SheetAction
            icon={Check}
            label={sheetDeposit.closed ? "Mark open" : "Mark matured"}
            onClick={() => {
              void banks.saveDeposit({ ...sheetDeposit, closed: !sheetDeposit.closed }, sheetDeposit.id);
              setSheet(null);
            }}
          />
          <SheetAction
            icon={Trash2}
            label="Remove"
            tone="danger"
            onClick={() => {
              void banks.removeDeposit(sheetDeposit.id);
              setSheet(null);
            }}
          />
        </ActionSheet>
      )}

      {detailAccount && (
        <AccountDetail
          account={detailAccount}
          onClose={() => setDetail(null)}
          onEdit={() => openEditor({ kind: "account", id: detailAccount.id })}
        />
      )}
      {detailDeposit && (
        <DepositDetail
          deposit={detailDeposit}
          onClose={() => setDetail(null)}
          onEdit={() => openEditor({ kind: "deposit", id: detailDeposit.id })}
        />
      )}
      {editor && (
        <Editor
          initialKind={editor.kind}
          account={editingAccount}
          deposit={editingDeposit}
          currency={entryCurrency}
          multi={multi}
          readonly={banks.readonly}
          onClose={() => setEditor(null)}
          onSaveAccount={(input) => void onSaveAccount(input)}
          onSaveDeposit={(input) => void onSaveDeposit(input)}
        />
      )}
    </div>
  );
}

function Overview({
  accounts,
  deposits,
  prefs,
  loading,
  onAdd,
  onOpenDeposit,
}: {
  accounts: BankAccount[];
  deposits: BankDeposit[];
  prefs: BanksPreferences;
  loading: boolean;
  onAdd: () => void;
  onOpenDeposit: (id: string) => void;
}) {
  const multi = usesMultipleCurrencies(accounts, deposits);
  const shown = displayCurrency(accounts, deposits, prefs.home);
  const worth = netWorth(accounts, deposits, shown, prefs.inrPerUsd);
  const focus = bankFocus(deposits).slice(0, 6);
  const empty = accounts.length === 0 && deposits.length === 0;

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Net worth</h1>
        <AddButton onClick={onAdd} />
      </div>
      <div className="mt-4 rounded-2xl bg-otto-surface px-4 py-4">
        <WorthSplit worth={worth} currency={shown} />
        {multi && worth.unconverted > 0 && (
          <p className="mt-2 text-center text-[12px] text-otto-text-dim">Set the exchange rate in Settings to combine both currencies.</p>
        )}
        {multi && worth.total != null && prefs.inrPerUsd && (
          <p className="mt-1 text-center text-[12px] text-otto-text-dim">Combined at 1 USD = {prefs.inrPerUsd} INR</p>
        )}
      </div>
      {multi && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["USD", "INR"] as const).map((currency) => (
            <div key={currency} className="rounded-2xl bg-otto-surface px-3 py-3">
              <div className="text-[12px] font-bold">{currency}</div>
              <div className="mt-1 text-[16px] font-extrabold">{money(nativeTotal(accounts, deposits, currency), currency)}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Coming up</p>
      {focus.length === 0 && (
        <p className="rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
          {loading
            ? "Loading accounts…"
            : empty
              ? "Add an account or a deposit. Maturity and interest dates show up here."
              : "Nothing matures in the next 45 days, and no interest is due in the next 3 weeks."}
        </p>
      )}
      <div className="space-y-2">
        {focus.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenDeposit(item.depositId)}
            className="block w-full rounded-2xl bg-otto-surface px-4 py-3 text-left"
          >
            <span className="block truncate text-[15px] font-extrabold">{item.title}</span>
            <span className="mt-0.5 block text-[12px] text-otto-text-dim">{item.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Holdings({
  accounts,
  deposits,
  prefs,
  loading,
  onAdd,
  onOpenAccount,
  onOpenDeposit,
}: {
  accounts: BankAccount[];
  deposits: BankDeposit[];
  prefs: BanksPreferences;
  loading: boolean;
  onAdd: () => void;
  onOpenAccount: (id: string) => void;
  onOpenDeposit: (id: string) => void;
}) {
  const today = new Date();
  const openDeposits = deposits
    .filter((item) => !item.closed)
    .sort((left, right) => (daysUntil(left.maturesOn, today) ?? 9_999) - (daysUntil(right.maturesOn, today) ?? 9_999));
  const groups = [
    { id: "cash", label: "Cash", accounts: accounts.filter((item) => accountBucket(item.kind) === "cash"), deposits: [] as BankDeposit[] },
    { id: "deposits", label: "Deposits", accounts: [] as BankAccount[], deposits: [...openDeposits, ...deposits.filter((item) => item.closed)] },
    { id: "trading", label: "Trading", accounts: accounts.filter((item) => item.kind === "trading"), deposits: [] as BankDeposit[] },
    { id: "owed", label: "Cards and loans", accounts: accounts.filter((item) => accountBucket(item.kind) === "liabilities"), deposits: [] as BankDeposit[] },
  ].filter((group) => group.accounts.length || group.deposits.length);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<HoldingSort>("group");
  const shown = filter === "all" ? groups : groups.filter((group) => group.id === filter);
  const shownAccounts = shown.flatMap((group) => group.accounts);
  const shownDeposits = shown.flatMap((group) => group.deposits);
  const flat = sortHoldings(
    shownAccounts,
    shownDeposits,
    sort,
    prefs.home,
    prefs.inrPerUsd
  );
  const filterLabel = filter === "all" ? "All holdings" : (groups.find((group) => group.id === filter)?.label ?? "Holdings");

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Holdings</h1>
        <div className="flex items-center gap-1">
          {groups.length > 0 && <HoldingSortMenu sort={sort} onSort={setSort} />}
          <AddButton onClick={onAdd} />
        </div>
      </div>
      {groups.length > 0 && (
        <HoldingsTotal
          label={filterLabel}
          accounts={shownAccounts}
          deposits={shownDeposits}
          prefs={prefs}
        />
      )}
      {groups.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {groups.map((group) => (
            <FilterChip key={group.id} label={group.label} active={filter === group.id} onClick={() => setFilter(group.id)} />
          ))}
        </div>
      )}
      {groups.length === 0 && (
        <p className="mt-4 rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
          {loading ? "Loading accounts…" : "Checking, deposits, trading balances, cards, and loans go here."}
        </p>
      )}
      {sort === "group"
        ? shown.map((group) => (
            <div key={group.id} className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">{group.label}</p>
              <div className="space-y-2">
                {group.accounts.map((item) => (
                  <AccountHolding key={item.id} item={item} prefs={prefs} onOpen={onOpenAccount} />
                ))}
                {group.deposits.map((item) => (
                  <DepositHolding key={item.id} item={item} prefs={prefs} onOpen={onOpenDeposit} />
                ))}
              </div>
            </div>
          ))
        : flat.length > 0 && (
            <div className="mt-4 space-y-2">
              {flat.map((row) =>
                row.kind === "account" ? (
                  <AccountHolding key={row.account.id} item={row.account} prefs={prefs} onOpen={onOpenAccount} />
                ) : (
                  <DepositHolding key={row.deposit.id} item={row.deposit} prefs={prefs} onOpen={onOpenDeposit} />
                )
              )}
            </div>
          )}
    </section>
  );
}

function HoldingsTotal({
  label,
  accounts,
  deposits,
  prefs,
}: {
  label: string;
  accounts: BankAccount[];
  deposits: BankDeposit[];
  prefs: BanksPreferences;
}) {
  const shown = displayCurrency(accounts, deposits, prefs.home);
  const worth = netWorth(accounts, deposits, shown, prefs.inrPerUsd);
  const currencies = (["USD", "INR"] as const).filter((currency) =>
    accounts.some((item) => item.currency === currency) ||
    deposits.some((item) => !item.closed && item.currency === currency)
  );
  const assets = worth.cash + worth.deposits + worth.investments;
  const both = assets > 0 && worth.liabilities > 0;
  const count = accounts.length + deposits.filter((item) => !item.closed).length;
  return (
    <div className="mt-4 rounded-2xl bg-otto-surface px-4 py-4">
      {both && <div className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">{label}</div>}
      <WorthSplit worth={worth} currency={shown} caption={both ? undefined : label} />
      <p className="mt-1 text-center text-[12px] text-otto-text-dim">
        {count} open {count === 1 ? "holding" : "holdings"}
      </p>
      {currencies.length > 1 && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-left">
          {currencies.map((currency) => (
            <div key={currency} className="rounded-xl bg-otto-bg px-3 py-2">
              <div className="text-[11px] font-bold text-otto-text-faint">{currency}</div>
              <div className="text-[15px] font-extrabold">{money(nativeTotal(accounts, deposits, currency), currency)}</div>
            </div>
          ))}
        </div>
      )}
      {worth.total == null && (
        <p className="mt-2 text-center text-[12px] text-otto-text-dim">Set the exchange rate in Settings to combine both currencies.</p>
      )}
    </div>
  );
}

function WorthSplit({ worth, currency, caption }: { worth: WorthBuckets; currency: BankCurrency; caption?: string }) {
  const assets = worth.cash + worth.deposits + worth.investments;
  const owed = worth.liabilities;
  if (assets > 0 && owed > 0) {
    return (
      <div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Assets</div>
            <div className="mt-0.5 text-[20px] font-black">{money(assets, currency)}</div>
          </div>
          <span className="pb-1 text-[18px] font-bold text-otto-text-faint">−</span>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Liabilities</div>
            <div className="mt-0.5 text-[20px] font-black">{money(owed, currency)}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-otto-divider pt-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">Net</div>
          <div className="mt-0.5 text-[28px] font-black">{worth.total == null ? "—" : money(worth.total, currency)}</div>
        </div>
      </div>
    );
  }
  const amount = owed > 0 ? -owed : assets > 0 ? assets : worth.total;
  return (
    <div className="text-center">
      {caption && <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">{caption}</div>}
      <div className="mt-1 text-[28px] font-black">{amount == null ? "—" : money(amount, currency)}</div>
    </div>
  );
}

function AccountHolding({ item, prefs, onOpen }: { item: BankAccount; prefs: BanksPreferences; onOpen: (id: string) => void }) {
  return (
    <HoldingRow
      title={accountTitle(item)}
      amount={item.balance}
      currency={item.currency}
      prefs={prefs}
      onClick={() => onOpen(item.id)}
    />
  );
}

function DepositHolding({ item, prefs, onOpen }: { item: BankDeposit; prefs: BanksPreferences; onOpen: (id: string) => void }) {
  return (
    <HoldingRow
      title={depositTitle(item)}
      amount={item.principal}
      currency={item.currency}
      prefs={prefs}
      onClick={() => onOpen(item.id)}
    />
  );
}

function accountTitle(account: BankAccount) {
  const name = account.nickname || account.institution;
  const kind = ACCOUNT_KIND_LABEL[account.kind];
  return name.toLowerCase().includes(kind.toLowerCase()) ? name : `${name} · ${kind}`;
}

function depositTitle(deposit: BankDeposit) {
  const kind = shortDepositKind(deposit.kind);
  const bank = deposit.institution.trim();
  const named = deposit.nickname.trim();
  const number = depositReference(deposit.notes);
  const identity = named && named.toLowerCase() !== bank.toLowerCase() ? named : kind;
  return [bank, identity, number].filter((part, index, parts) => part && parts.indexOf(part) === index).join(" · ");
}

function shortDepositKind(kind: BankDeposit["kind"]) {
  if (kind === "fd") return "FD";
  if (kind === "cd") return "CD";
  if (kind === "rd") return "RD";
  if (kind === "ppf") return "PPF";
  if (kind === "scss") return "SCSS";
  if (kind === "po") return "PO";
  return DEPOSIT_TREATMENT[kind].label;
}

function HoldingRow({
  title,
  amount,
  currency,
  prefs,
  onClick,
}: {
  title: string;
  amount: number;
  currency: BankCurrency;
  prefs: BanksPreferences;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-otto-surface px-4 py-3 text-left">
      <span className="min-w-0 truncate text-[15px] font-extrabold">{title}</span>
      <HoldingAmount amount={amount} currency={currency} prefs={prefs} />
    </button>
  );
}

function HoldingAmount({ amount, currency, prefs }: { amount: number; currency: BankCurrency; prefs: BanksPreferences }) {
  const native = moneyWhole(amount, currency);
  const converted = currency === prefs.home ? null : toHome(amount, currency, prefs.home, prefs.inrPerUsd);
  if (converted == null) return <span className="shrink-0 text-[15px] font-bold tabular-nums">{native}</span>;
  return (
    <span className="shrink-0 text-right">
      <span className="text-[15px] font-bold tabular-nums">{moneyWhole(converted, prefs.home)}</span>
      <span className="ml-1.5 text-[11px] font-semibold text-otto-text-faint tabular-nums">{native}</span>
    </span>
  );
}

function HoldingSortMenu({ sort, onSort }: { sort: HoldingSort; onSort: (sort: HoldingSort) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-otto-text-faint hover:bg-otto-surface"
        aria-label="Sort holdings"
        aria-expanded={open}
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close sort menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-xl border border-otto-divider bg-otto-bg p-1.5 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-otto-text-faint">Sort by</p>
            {HOLDING_SORTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSort(id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium hover:bg-otto-surface"
              >
                <span className="flex-1">{label}</span>
                {sort === id && <Check size={15} className="text-otto-green" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${active ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"}`}
    >
      {label}
    </button>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Add" className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-green text-black">
      <Plus size={18} />
    </button>
  );
}

function BanksSettings({
  prefs,
  multi,
  accounts,
  deposits,
  readonly,
  onPrefs,
  onClear,
  onImport,
}: {
  prefs: BanksPreferences;
  multi: boolean;
  accounts: BankAccount[];
  deposits: BankDeposit[];
  readonly: boolean;
  onPrefs: (next: BanksPreferences) => void;
  onClear: () => Promise<void>;
  onImport: (parsed: ParsedTransfer) => Promise<void>;
}) {
  const [rate, setRate] = useState(prefs.inrPerUsd ? String(prefs.inrPerUsd) : "");
  const [transferOpen, setTransferOpen] = useState(false);
  const [preview, setPreview] = useState<ParsedTransfer | null>(null);
  const [transferNote, setTransferNote] = useState("");
  const [clearNote, setClearNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Settings</h1>
      <div className="mt-4">
        <SectionPreferences />
      </div>
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl bg-otto-surface p-4">
          <ChoiceRow
            label="Preferred currency"
            value={prefs.home}
            options={[["USD", "US dollar"], ["INR", "Indian rupee"]] as const}
            onChange={(home) => onPrefs({ ...prefs, home })}
          />
          <p className="mt-2 text-[11.5px] leading-relaxed text-otto-text-faint">
            {multi
              ? "Totals use this currency. Each entry can still be dollars or rupees."
              : "Totals stay in the currency you actually hold. The exchange rate appears once an entry uses the other one."}
          </p>
          {multi && (
            <label className="mt-3 block text-[13px] font-semibold">
              Exchange rate
              <span className="mt-0.5 block text-[11.5px] font-normal text-otto-text-faint">1 US dollar equals this many rupees.</span>
              <input
                value={rate}
                inputMode="decimal"
                placeholder="For example 83"
                aria-label="Rupees per US dollar"
                onChange={(event) => setRate(event.target.value)}
                onBlur={() => {
                  const next = Number(rate);
                  onPrefs({ ...prefs, inrPerUsd: Number.isFinite(next) && next > 0 ? next : null });
                }}
                className="mt-2 w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px] font-normal"
              />
            </label>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl bg-otto-surface">
          <SettingsRow
            icon={Import}
            label="Import & export"
            detail="Workbook or CSV"
            onClick={() => setTransferOpen(true)}
          />
        </div>
        <DataTransferCard
          icon={Trash2}
          title="Delete all bank data"
          description="Removes every account, deposit, and saved balance change. Use this to clear a test import and start again."
        >
          <button
            type="button"
            disabled={busy || readonly || (accounts.length === 0 && deposits.length === 0)}
            onClick={() => {
              if (!window.confirm("Delete all bank accounts, deposits, and balance history?")) return;
              setBusy(true);
              setClearNote("");
              void onClear()
                .then(() => setClearNote("All bank data was deleted."))
                .catch((cause) => setClearNote(cause instanceof Error ? cause.message : "Could not delete bank data."))
                .finally(() => setBusy(false));
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-otto-red-soft px-4 py-2.5 text-xs font-bold text-otto-red disabled:opacity-40"
          >
            <Trash2 size={14} />
            {busy ? "Deleting…" : "Delete everything"}
          </button>
        </DataTransferCard>
        {clearNote && <p className="text-[13px] text-otto-text-dim">{clearNote}</p>}
      </div>
      {transferOpen && (
        <SettingsDetailScreen title="Import & export" eyebrow="Banks data" onClose={() => setTransferOpen(false)}>
          <div className="space-y-3">
        <DataTransferCard
          icon={Upload}
          title="Import accounts"
          description="Choose an Otto workbook, Otto CSV, or a household Banks, Deposits, or post office sheet. Nothing is saved until you confirm the preview."
          tone="accent"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setTransferNote("");
              void readTransferFile(file).then(setPreview).catch(() => setTransferNote("Could not read that file."));
            }}
          />
          <DataTransferButton variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} />
            Choose file
          </DataTransferButton>
          {preview && (
            <ImportPreview
              preview={preview}
              accounts={accounts}
              deposits={deposits}
              busy={busy}
              onImport={() => {
                setBusy(true);
                setTransferNote("");
                void onImport(preview)
                  .then(() => {
                    setTransferNote("Import saved.");
                    setPreview(null);
                  })
                  .catch((cause) => setTransferNote(cause instanceof Error ? cause.message : "Could not import."))
                  .finally(() => setBusy(false));
              }}
            />
          )}
        </DataTransferCard>
        <DataTransferCard
          icon={Download}
          title="Export accounts"
          description="Download a workbook or CSV. Either file can be imported back into Banks."
        >
          <div className="grid grid-cols-2 gap-2">
            <DataTransferButton onClick={() => void exportWorkbook(accounts, deposits)}>
              <Download size={14} />
              Export workbook
            </DataTransferButton>
            <DataTransferButton variant="secondary" onClick={() => downloadBanksCsv(accounts, deposits)}>
              <Download size={14} />
              Export CSV
            </DataTransferButton>
          </div>
        </DataTransferCard>
        <DataTransferNotice>
          Files stay on this device. Household sheets are read when a row has a type and an amount. Trading balances here are approximate totals for net worth.
        </DataTransferNotice>
        {transferNote && <p className="text-[13px] text-otto-text-dim">{transferNote}</p>}
          </div>
        </SettingsDetailScreen>
      )}
    </section>
  );
}

function ImportPreview({
  preview,
  accounts,
  deposits,
  busy,
  onImport,
}: {
  preview: ParsedTransfer;
  accounts: BankAccount[];
  deposits: BankDeposit[];
  busy: boolean;
  onImport: () => void;
}) {
  const plan = planBankImport(preview, accounts, deposits);
  return (
    <div className="mt-3">
      <p className="text-[13px] font-bold">
        {plan.created.length} new, {plan.updated.length} updated, {plan.skipped.length} skipped
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
        Matching rows update. New rows are added. Full account numbers stay as the last 4 only.
      </p>
      <PreviewGroup title="New" rows={plan.created} />
      <PreviewGroup title="Updated" rows={plan.updated} />
      {plan.unchanged.length > 0 && (
        <p className="mt-3 text-[12px] text-otto-text-dim">{plan.unchanged.length} already saved with no changes.</p>
      )}
      <PreviewGroup title="Skipped" rows={plan.skipped.map((row) => ({ label: row.label, detail: row.reason }))} />
      <div className="mt-3">
        <DataTransferButton disabled={busy || (plan.created.length === 0 && plan.updated.length === 0)} onClick={onImport}>
          {busy ? "Importing…" : "Import these rows"}
        </DataTransferButton>
      </div>
    </div>
  );
}

function PreviewGroup({ title, rows }: { title: string; rows: { label: string; detail: string }[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">
        {title} · {rows.length}
      </p>
      <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl bg-otto-bg">
        {rows.map((row, index) => (
          <li key={`${row.label}-${index}`} className="border-t border-otto-divider px-3 py-2 first:border-t-0">
            <span className="block text-[12.5px] font-bold">{row.label}</span>
            <span className="block text-[11px] text-otto-text-faint">{row.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Editor({
  initialKind,
  account,
  deposit,
  currency,
  multi,
  readonly,
  onClose,
  onSaveAccount,
  onSaveDeposit,
}: {
  initialKind: "account" | "deposit";
  account: BankAccount | null;
  deposit: BankDeposit | null;
  currency: BankCurrency;
  multi: boolean;
  readonly: boolean;
  onClose: () => void;
  onSaveAccount: (input: BankAccountInput) => void;
  onSaveDeposit: (input: BankDepositInput) => void;
}) {
  const editing = Boolean(account || deposit);
  const [mode, setMode] = useState(deposit ? "deposit" : initialKind);
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-otto-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-otto-divider bg-otto-bg/95 px-3 py-3 backdrop-blur">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface" aria-label="Close">
          <X size={18} />
        </button>
        <b className="text-[15px]">{editing ? "Edit" : "Add"}</b>
        <button type="submit" form={`bank-editor-${mode}`} disabled={readonly} className="px-2 text-[14px] font-bold text-otto-green disabled:opacity-40">
          Save
        </button>
      </header>
      <main className="mx-auto w-full max-w-[720px] px-[18px] py-5 pb-12">
        {!editing && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-otto-surface p-1.5">
            {(["account", "deposit"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-xl py-2.5 text-[13px] font-bold ${mode === item ? "bg-otto-text text-otto-bg" : "text-otto-text-dim"}`}
              >
                {item === "account" ? "Account" : "Deposit"}
              </button>
            ))}
          </div>
        )}
        {mode === "account" ? (
          <AccountForm formId="bank-editor-account" preferred={currency} multi={multi} initial={account} readonly={readonly} onSave={onSaveAccount} />
        ) : (
          <DepositForm formId="bank-editor-deposit" preferred={currency} multi={multi} initial={deposit} readonly={readonly} onSave={onSaveDeposit} />
        )}
      </main>
    </div>
  );
}

function AccountForm({
  formId,
  preferred,
  multi,
  initial,
  readonly,
  onSave,
}: {
  formId: string;
  preferred: BankCurrency;
  multi: boolean;
  initial: BankAccount | null;
  readonly: boolean;
  onSave: (input: BankAccountInput) => void;
}) {
  const [draft, setDraft] = useState<BankAccountInput>(
    initial ?? { ...EMPTY_ACCOUNT, currency: preferred, country: countryFromCurrency(preferred) }
  );
  const [balance, setBalance] = useState(initial ? String(initial.balance) : "");
  const [more, setMore] = useState(Boolean(initial && (initial.owner || initial.last4 || initial.nominee || initial.notes || (!multi && initial.currency !== preferred))));
  return (
    <form
      id={formId}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.institution.trim()) return;
        onSave({ ...draft, balance: Number(balance) || 0, country: countryFromCurrency(draft.currency) });
      }}
    >
      <ChoiceRow
        label="Type"
        value={draft.kind}
        options={ACCOUNT_KINDS.map((id) => [id, ACCOUNT_KIND_LABEL[id]] as const)}
        onChange={(kind) => setDraft({ ...draft, kind })}
      />
      {draft.kind === "trading" && (
        <p className="px-1 text-[12px] text-otto-text-dim">An approximate total for net worth. Day-to-day trades stay in Trader.</p>
      )}
      <Field label="Institution" value={draft.institution} onChange={(institution) => setDraft({ ...draft, institution })} placeholder="Bank or broker" />
      <Field label="Nickname" value={draft.nickname} onChange={(nickname) => setDraft({ ...draft, nickname })} placeholder="Optional" />
      <Field label="Balance" value={balance} onChange={setBalance} placeholder="0.00" numeric />
      {multi && (
        <ChoiceRow
          label="Currency"
          value={draft.currency}
          options={BANK_CURRENCIES.map((id) => [id, id] as const)}
          onChange={(currency) => setDraft({ ...draft, currency })}
        />
      )}
      <MoreToggle open={more} onToggle={() => setMore((current) => !current)} />
      {more && (
        <>
          {!multi && (
            <ChoiceRow
              label="Currency"
              value={draft.currency}
              options={BANK_CURRENCIES.map((id) => [id, id] as const)}
              onChange={(currency) => setDraft({ ...draft, currency })}
            />
          )}
          <Field label="Owner" value={draft.owner} onChange={(owner) => setDraft({ ...draft, owner })} placeholder="Optional, such as joint" />
          <Field label="Last 4" value={draft.last4} onChange={(last4) => setDraft({ ...draft, last4 })} placeholder="Optional" />
          <Field label="Nominee" value={draft.nominee} onChange={(nominee) => setDraft({ ...draft, nominee })} placeholder="Optional" />
          <Field label="Notes" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} placeholder="Optional" />
        </>
      )}
      <button type="submit" disabled={readonly} className="mt-2 w-full rounded-full bg-otto-green py-3 text-[15px] font-bold text-black disabled:opacity-40">
        Save account
      </button>
    </form>
  );
}

function DepositForm({
  formId,
  preferred,
  multi,
  initial,
  readonly,
  onSave,
}: {
  formId: string;
  preferred: BankCurrency;
  multi: boolean;
  initial: BankDeposit | null;
  readonly: boolean;
  onSave: (input: BankDepositInput) => void;
}) {
  const [draft, setDraft] = useState<BankDepositInput>(
    initial
      ? { ...initial, notes: notesWithDepositReference(initial.notes, "") }
      : { ...EMPTY_DEPOSIT, currency: preferred, country: countryFromCurrency(preferred), payout: DEPOSIT_TREATMENT.fd.defaultPayout }
  );
  const [principal, setPrincipal] = useState(initial ? String(initial.principal) : "");
  const [rate, setRate] = useState(initial?.rate != null ? String(initial.rate) : "");
  const [number, setNumber] = useState(initial ? depositReference(initial.notes) : "");
  const [more, setMore] = useState(
    Boolean(initial && (initial.owner || initial.nominee || notesWithDepositReference(initial.notes, "") || (!multi && initial.currency !== preferred)))
  );
  return (
    <form
      id={formId}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.institution.trim()) return;
        onSave({
          ...draft,
          principal: Number(principal) || 0,
          rate: rate.trim() ? Number(rate) : null,
          country: countryFromCurrency(draft.currency),
          notes: notesWithDepositReference(draft.notes, number),
        });
      }}
    >
      <ChoiceRow
        label="Type"
        value={draft.kind}
        options={DEPOSIT_KINDS.map((id) => [id, DEPOSIT_TREATMENT[id].label] as const)}
        onChange={(kind) =>
          setDraft({
            ...draft,
            kind,
            payout: kind === draft.kind ? draft.payout : DEPOSIT_TREATMENT[kind].defaultPayout,
          })
        }
      />
      <p className="px-1 text-[12px] leading-relaxed text-otto-text-dim">{DEPOSIT_TREATMENT[draft.kind].lockIn}</p>
      <Field label="Institution" value={draft.institution} onChange={(institution) => setDraft({ ...draft, institution })} placeholder="Bank or post office" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nickname" value={draft.nickname} onChange={(nickname) => setDraft({ ...draft, nickname })} placeholder="Optional" />
        <Field label="Deposit number" value={number} onChange={setNumber} placeholder="Optional" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Principal" value={principal} onChange={setPrincipal} placeholder="0.00" numeric />
        <Field label="Rate %" value={rate} onChange={setRate} placeholder="0.00" numeric />
      </div>
      <ChoiceRow
        label="Interest"
        value={draft.payout}
        options={DEPOSIT_PAYOUTS.map((id) => [id, PAYOUT_LABEL[id]] as const)}
        onChange={(payout) => setDraft({ ...draft, payout })}
      />
      <label className="block text-[12px] font-semibold text-otto-text-dim">
        Start
        <input type="date" value={draft.startedOn ?? ""} onChange={(event) => setDraft({ ...draft, startedOn: event.target.value || null })} className="mt-1 w-full rounded-xl bg-otto-surface px-3 py-2.5 text-[14px] font-normal text-otto-text" />
      </label>
      <label className="block text-[12px] font-semibold text-otto-text-dim">
        Matures
        <input type="date" value={draft.maturesOn ?? ""} onChange={(event) => setDraft({ ...draft, maturesOn: event.target.value || null })} className="mt-1 w-full rounded-xl bg-otto-surface px-3 py-2.5 text-[14px] font-normal text-otto-text" />
      </label>
      <ChoiceRow
        label="At maturity"
        value={draft.renew}
        options={DEPOSIT_RENEWS.map((id) => [id, RENEW_LABEL[id]] as const)}
        onChange={(renew) => setDraft({ ...draft, renew })}
      />
      <p className="px-1 text-[12px] text-otto-text-dim">{maturityOutlook(draft.kind, draft.renew)}</p>
      {multi && (
        <ChoiceRow
          label="Currency"
          value={draft.currency}
          options={BANK_CURRENCIES.map((id) => [id, id] as const)}
          onChange={(currency) => setDraft({ ...draft, currency })}
        />
      )}
      <MoreToggle open={more} onToggle={() => setMore((current) => !current)} />
      {more && (
        <>
          {!multi && (
            <ChoiceRow
              label="Currency"
              value={draft.currency}
              options={BANK_CURRENCIES.map((id) => [id, id] as const)}
              onChange={(currency) => setDraft({ ...draft, currency })}
            />
          )}
          <Field label="Owner" value={draft.owner} onChange={(owner) => setDraft({ ...draft, owner })} placeholder="Optional" />
          <Field label="Nominee" value={draft.nominee} onChange={(nominee) => setDraft({ ...draft, nominee })} placeholder="Optional" />
          <Field label="Notes" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} placeholder="Optional" />
        </>
      )}
      <button type="submit" disabled={readonly} className="mt-2 w-full rounded-full bg-otto-green py-3 text-[15px] font-bold text-black disabled:opacity-40">
        Save deposit
      </button>
    </form>
  );
}

function AccountDetail({
  account,
  onClose,
  onEdit,
}: {
  account: BankAccount;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <DetailShell title="Account" onClose={onClose} onEdit={onEdit}>
      <h1 className="text-[22px] font-extrabold leading-tight">{account.nickname || account.institution}</h1>
      <p className="mt-1 text-[13.5px] text-otto-text-dim">
        {account.nickname ? account.institution : ACCOUNT_KIND_LABEL[account.kind]}
      </p>
      <p className="mt-3 text-[28px] font-black">{money(account.balance, account.currency)}</p>
      <p className="mt-1 text-[12px] font-bold uppercase tracking-wide text-otto-text-faint">{account.currency}</p>
      <div className="mt-6 overflow-hidden rounded-2xl bg-otto-surface">
        <DetailRow label="Type" value={account.kind === "trading" ? "Trading · approximate balance" : accountBucket(account.kind) === "liabilities" ? `${ACCOUNT_KIND_LABEL[account.kind]} · owed` : ACCOUNT_KIND_LABEL[account.kind]} />
        <Divider />
        <DetailRow label="Currency" value={account.currency} />
        {account.owner && (
          <>
            <Divider />
            <DetailRow label="Owner" value={account.owner} />
          </>
        )}
        {account.last4 && (
          <>
            <Divider />
            <DetailRow label="Last 4" value={account.last4} />
          </>
        )}
        {account.nominee && (
          <>
            <Divider />
            <DetailRow label="Nominee" value={account.nominee} />
          </>
        )}
      </div>
      {account.kind === "trading" && (
        <p className="mt-4 text-[13px] leading-relaxed text-otto-text-dim">Day-to-day trades stay in Trader. This figure is only for net worth.</p>
      )}
      {account.notes && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed">{account.notes}</p>}
    </DetailShell>
  );
}

function DepositDetail({
  deposit,
  onClose,
  onEdit,
}: {
  deposit: BankDeposit;
  onClose: () => void;
  onEdit: () => void;
}) {
  const treatment = DEPOSIT_TREATMENT[deposit.kind];
  const days = daysUntil(deposit.maturesOn);
  const number = depositReference(deposit.notes);
  const notes = notesWithDepositReference(deposit.notes, "");
  return (
    <DetailShell title="Deposit" onClose={onClose} onEdit={onEdit}>
      <h1 className="text-[22px] font-extrabold leading-tight">{deposit.nickname || deposit.institution}</h1>
      <p className="mt-1 text-[13.5px] text-otto-text-dim">
        {treatment.label}
        {deposit.nickname ? ` · ${deposit.institution}` : ""}
      </p>
      <p className="mt-3 text-[28px] font-black">{money(deposit.principal, deposit.currency)}</p>
      <p className="mt-1 text-[12px] font-bold uppercase tracking-wide text-otto-text-faint">{deposit.currency}</p>
      <p className="mt-1 text-[13px] text-otto-text-dim">{depositWhen(deposit)}</p>
      <div className="mt-6 overflow-hidden rounded-2xl bg-otto-surface">
        {deposit.rate != null && (
          <>
            <DetailRow label="Rate" value={`${deposit.rate}%`} />
            <Divider />
          </>
        )}
        <DetailRow label="Interest" value={PAYOUT_LABEL[deposit.payout]} />
        {deposit.startedOn && (
          <>
            <Divider />
            <DetailRow label="Start" value={fmtDate(deposit.startedOn)} />
          </>
        )}
        {deposit.maturesOn && (
          <>
            <Divider />
            <DetailRow label="Matures" value={`${fmtDate(deposit.maturesOn)}${days != null && !deposit.closed ? ` · ${depositWhen(deposit)}` : ""}`} />
          </>
        )}
        <Divider />
        <DetailRow label="At maturity" value={maturityOutlook(deposit.kind, deposit.renew)} />
        <Divider />
        <DetailRow label="Currency" value={deposit.currency} />
        {number && (
          <>
            <Divider />
            <DetailRow label="Deposit number" value={number} />
          </>
        )}
        {deposit.owner && (
          <>
            <Divider />
            <DetailRow label="Owner" value={deposit.owner} />
          </>
        )}
        {deposit.nominee && (
          <>
            <Divider />
            <DetailRow label="Nominee" value={deposit.nominee} />
          </>
        )}
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-otto-text-dim">{treatment.lockIn}</p>
      {deposit.kind === "rd" && (
        <p className="mt-2 text-[13px] leading-relaxed text-otto-text-dim">Principal is the amount saved so far, not the maturity value.</p>
      )}
      {notes && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed">{notes}</p>}
    </DetailShell>
  );
}

function DetailShell({
  title,
  onClose,
  onEdit,
  children,
}: {
  title: string;
  onClose: () => void;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-otto-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-otto-divider bg-otto-bg/95 px-3 py-3 backdrop-blur">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface" aria-label="Close">
          <X size={18} />
        </button>
        <b className="text-[15px]">{title}</b>
        <button type="button" onClick={onEdit} className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface" aria-label="Edit">
          <Pencil size={16} />
        </button>
      </header>
      <main className="mx-auto w-full max-w-[720px] px-[18px] py-7 pb-12">{children}</main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-[13px] text-otto-text-dim">{label}</span>
      <span className="text-right text-[14px] font-semibold">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 h-px bg-otto-divider" />;
}

function MoreToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="px-1 py-1 text-[13px] font-bold text-otto-text-dim">
      {open ? "Hide extra details" : "More details"}
    </button>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-otto-text-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${value === id ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  numeric?: boolean;
}) {
  return (
    <label className="block text-[12px] font-semibold text-otto-text-dim">
      {label}
      <input
        value={value}
        inputMode={numeric ? "decimal" : "text"}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-otto-surface px-3 py-2.5 text-[14px] font-normal text-otto-text"
      />
    </label>
  );
}

function downloadBanksCsv(accounts: BankAccount[], deposits: BankDeposit[]) {
  const header = ["record", "type", "institution", "nickname", "owner", "currency", "amount", "rate", "payout", "started", "matures", "renew", "closed", "last4", "nominee", "notes"];
  const lines = [
    header,
    ...accounts.map((item) => ["account", item.kind, item.institution, item.nickname, item.owner, item.currency, item.balance, "", "", "", "", "", "", item.last4, item.nominee, item.notes]),
    ...deposits.map((item) => ["deposit", item.kind, item.institution, item.nickname, item.owner, item.currency, item.principal, item.rate ?? "", item.payout, item.startedOn ?? "", item.maturesOn ?? "", item.renew, item.closed ? "yes" : "no", "", item.nominee, item.notes]),
  ].map((row) => row.map(csv).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "otto-banks.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function exportWorkbook(accounts: BankAccount[], deposits: BankDeposit[]) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const sheet of ottoSheets(accounts, deposits)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  XLSX.writeFile(book, "otto-banks.xlsx");
}

async function readTransferFile(file: File) {
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return parseBankSheets(
    book.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: true, defval: "" }) as unknown[][],
    }))
  );
}

function csv(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
