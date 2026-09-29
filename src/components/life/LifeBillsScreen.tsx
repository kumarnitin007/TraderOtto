"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { ActionSheet, SheetAction } from "@/components/ui/ActionSheet";
import { useBills } from "@/hooks/useBills";
import {
  BILL_CATEGORY_LABEL,
  BILL_FREQUENCY_LABEL,
  BILL_MONTHS,
  billStatus,
  billWhen,
  billsForList,
  dueThisMonthTotal,
  monthKey,
  type BillListFilter,
  type BillSort,
} from "@/lib/bills";
import { fmtMoney } from "@/lib/pnl";
import { BILL_CATEGORIES, BILL_FREQUENCIES, type Bill, type BillCategory, type BillFrequency } from "@/types/bill";

const FILTERS: { id: BillListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "month", label: "This month" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "semimonthly", label: "Twice a month" },
  { id: "bimonthly", label: "Every other month" },
];

export function LifeBillsScreen() {
  const { bills, loading, error, readonly, save, remove } = useBills();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [filter, setFilter] = useState<BillListFilter>("all");
  const [sort, setSort] = useState<BillSort>("due");
  const [notice, setNotice] = useState("");
  const today = new Date();
  const visible = billsForList(bills, filter, sort, today);
  const dueTotal = dueThisMonthTotal(bills, today);
  const unpaidCount = bills.filter((bill) => {
    const status = billStatus(bill, today);
    return status.active && !status.paid;
  }).length;

  async function saveBill(input: Parameters<typeof save>[0], id?: string) {
    setNotice("");
    try {
      await save(input, id);
      setAdding(false);
      setEditing(null);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not save this bill.");
    }
  }

  async function togglePaid(bill: Bill) {
    const paid = billStatus(bill, today).paid;
    try {
      await save({ ...bill, paidMonth: paid ? null : monthKey(today) }, bill.id);
      setSelected(null);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update this bill.");
    }
  }

  const formBill = editing;

  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        This month
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Bills</h1>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-otto-surface px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-otto-text-faint">Due this month</div>
          <div className="mt-1 text-xl font-extrabold">{fmtMoney(dueTotal)}</div>
        </div>
        <div className="rounded-2xl bg-otto-surface px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-otto-text-faint">Unpaid</div>
          <div className="mt-1 text-xl font-extrabold">{unpaidCount}</div>
        </div>
      </div>
      {error && <p className="mt-3 text-[12px] text-otto-red">{error}</p>}
      {notice && <p className="mt-3 text-[12px] text-otto-red">{notice}</p>}

      <div className="mt-4 flex items-center gap-2">
        <div className="-mx-[18px] flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`shrink-0 snap-start rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                filter === item.id ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-2 flex items-center justify-between text-[12px] font-semibold text-otto-text-dim">
        Sort
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as BillSort)}
          aria-label="Sort bills"
          className="rounded-full bg-otto-surface px-3 py-1.5 text-[12.5px] font-semibold text-otto-text"
        >
          <option value="due">Due day</option>
          <option value="amount">Amount</option>
          <option value="name">Name</option>
        </select>
      </label>

      <div className="mt-3 space-y-2">
        {visible.map((bill) => {
          const status = billStatus(bill, today);
          const when = status.paid
            ? "Paid"
            : !status.active
              ? "Not this month"
              : !bill.dueSet
                ? "No due day"
                : status.days < 0
                  ? `${Math.abs(status.days)}d late`
                  : status.days === 0
                    ? "Due today"
                    : `Due in ${status.days}d`;
          return (
            <button
              key={bill.id}
              type="button"
              onClick={() => setSelected(bill)}
              className="flex w-full items-center gap-3 rounded-2xl bg-otto-surface px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-extrabold">{bill.name}</span>
                  <span className="shrink-0 text-[14px] font-bold">
                    {bill.amount != null ? fmtMoney(bill.amount) : "—"}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-otto-text-dim">
                  {BILL_FREQUENCY_LABEL[bill.frequency]} · {when}
                </span>
              </span>
            </button>
          );
        })}
        {!loading && visible.length === 0 && (
          <p className="rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
            {bills.length === 0
              ? "Add a monthly, twice-a-month, every-other-month, or yearly bill."
              : "Nothing matches this filter."}
          </p>
        )}
      </div>

      {formBill || adding ? (
        <BillForm
          bill={formBill}
          readonly={readonly}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(input) => void saveBill(input, formBill?.id)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-otto-surface py-3 text-[13px] font-bold">
          <Plus size={15} /> Add a bill
        </button>
      )}

      {selected && (
        <ActionSheet
          title={selected.name}
          subtitle={`${BILL_FREQUENCY_LABEL[selected.frequency]} · ${billWhen(selected)}${selected.amount != null ? ` · ${fmtMoney(selected.amount)}` : ""}`}
          icon={Receipt}
          onClose={() => setSelected(null)}
        >
          <SheetAction
            icon={Check}
            label={billStatus(selected, today).paid ? "Mark unpaid" : "Mark paid"}
            onClick={() => void togglePaid(selected)}
          />
          <SheetAction
            icon={Pencil}
            label="Edit"
            onClick={() => {
              setEditing(selected);
              setSelected(null);
              setAdding(false);
            }}
          />
          <SheetAction
            icon={Trash2}
            label="Remove"
            tone="danger"
            onClick={() => {
              void remove(selected.id);
              setSelected(null);
            }}
          />
        </ActionSheet>
      )}
    </section>
  );
}

function BillForm({
  bill,
  readonly,
  onCancel,
  onSave,
}: {
  bill: Bill | null;
  readonly: boolean;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    amount: number | null;
    dueDay: number;
    dueDay2: number | null;
    dueMonth: number | null;
    dueSet: boolean;
    frequency: BillFrequency;
    category: BillCategory;
    paidMonth: string | null;
  }) => void;
}) {
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill?.amount != null ? String(bill.amount) : "");
  const [dueDay, setDueDay] = useState(bill ? String(bill.dueDay) : "1");
  const [dueDay2, setDueDay2] = useState(bill?.dueDay2 ? String(bill.dueDay2) : "15");
  const [dueMonth, setDueMonth] = useState(String(bill?.dueMonth ?? new Date().getMonth() + 1));
  const [category, setCategory] = useState<BillCategory>(bill?.category ?? "other");
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? "monthly");

  return (
    <form
      className="mt-3 space-y-2 rounded-2xl bg-otto-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onSave({
          name,
          amount: amount.trim() ? Number(amount) : null,
          dueDay: Number(dueDay) || 1,
          dueDay2: frequency === "semimonthly" ? Number(dueDay2) || null : null,
          dueMonth: frequency === "yearly" || frequency === "bimonthly" ? Number(dueMonth) || null : null,
          dueSet: Boolean(dueDay.trim()),
          frequency,
          category,
          paidMonth: bill?.paidMonth ?? null,
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold">{bill ? "Edit bill" : "New bill"}</h2>
        <button type="button" onClick={onCancel} className="text-[13px] font-semibold text-otto-text-dim">
          Cancel
        </button>
      </div>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Water, Visa, mortgage…" className="w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
      <select value={frequency} onChange={(event) => setFrequency(event.target.value as BillFrequency)} aria-label="How often" className="w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]">
        {BILL_FREQUENCIES.map((item) => (
          <option key={item} value={item}>{BILL_FREQUENCY_LABEL[item]}</option>
        ))}
      </select>
      <div className={`grid gap-2 ${frequency === "semimonthly" ? "grid-cols-3" : "grid-cols-2"}`}>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Amount" className="rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
        <input value={dueDay} onChange={(event) => setDueDay(event.target.value)} inputMode="numeric" placeholder="Due day" aria-label="Due day" className="rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
        {frequency === "semimonthly" && (
          <input value={dueDay2} onChange={(event) => setDueDay2(event.target.value)} inputMode="numeric" placeholder="2nd day" aria-label="Second due day" className="rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
        )}
      </div>
      {(frequency === "yearly" || frequency === "bimonthly") && (
        <select value={dueMonth} onChange={(event) => setDueMonth(event.target.value)} aria-label={frequency === "yearly" ? "Due month" : "Starting month"} className="w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]">
          {BILL_MONTHS.map((label, index) => (
            <option key={label} value={String(index + 1)}>{frequency === "yearly" ? label : `${label} and every other month`}</option>
          ))}
        </select>
      )}
      <select value={category} onChange={(event) => setCategory(event.target.value as BillCategory)} className="w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]">
        {BILL_CATEGORIES.map((item) => (
          <option key={item} value={item}>{BILL_CATEGORY_LABEL[item]}</option>
        ))}
      </select>
      <button type="submit" disabled={readonly} className="w-full rounded-full bg-otto-green py-2.5 text-[13px] font-bold text-black disabled:opacity-40">
        Save bill
      </button>
    </form>
  );
}
