"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useBills } from "@/hooks/useBills";
import { BILL_CATEGORY_LABEL, billStatus, monthKey, orderedBills } from "@/lib/bills";
import { fmtMoney } from "@/lib/pnl";
import { BILL_CATEGORIES, type Bill, type BillCategory } from "@/types/bill";

export function LifeBillsScreen() {
  const { bills, loading, error, readonly, save, remove } = useBills();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [category, setCategory] = useState<BillCategory>("other");
  const [notice, setNotice] = useState("");
  const today = new Date();
  const ordered = orderedBills(bills);
  const unpaid = ordered.filter((bill) => !billStatus(bill, today).paid);
  const dueTotal = unpaid.reduce((sum, bill) => sum + (bill.amount ?? 0), 0);

  async function addBill() {
    if (!name.trim()) return;
    setNotice("");
    try {
      await save({
        name,
        amount: amount.trim() ? Number(amount) : null,
        dueDay: Number(dueDay) || 1,
        category,
        paidMonth: null,
      });
      setName("");
      setAmount("");
      setDueDay("1");
      setCategory("other");
      setAdding(false);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not save this bill.");
    }
  }

  async function togglePaid(bill: Bill) {
    const paid = billStatus(bill, today).paid;
    try {
      await save(
        { ...bill, paidMonth: paid ? null : monthKey(today) },
        bill.id
      );
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not update this bill.");
    }
  }

  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        This month
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Bills</h1>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-otto-surface px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-otto-text-faint">Still due</div>
          <div className="mt-1 text-xl font-extrabold">{fmtMoney(dueTotal)}</div>
        </div>
        <div className="rounded-2xl bg-otto-surface px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-otto-text-faint">Unpaid</div>
          <div className="mt-1 text-xl font-extrabold">{unpaid.length}</div>
        </div>
      </div>
      {error && <p className="mt-3 text-[12px] text-otto-red">{error}</p>}
      {notice && <p className="mt-3 text-[12px] text-otto-red">{notice}</p>}
      <div className="mt-4 space-y-2">
        {ordered.map((bill) => {
          const status = billStatus(bill, today);
          return (
            <article key={bill.id} className="rounded-2xl bg-otto-surface px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-extrabold">{bill.name}</h2>
                  <p className="mt-0.5 text-[12px] text-otto-text-dim">
                    {BILL_CATEGORY_LABEL[bill.category]} · due the {bill.dueDay}
                    {bill.amount != null ? ` · ${fmtMoney(bill.amount)}` : ""}
                  </p>
                  <p className={`mt-1 text-[11px] font-semibold ${status.paid ? "text-otto-green" : "text-otto-text-faint"}`}>
                    {status.paid
                      ? "Paid this month"
                      : status.days < 0
                        ? `${Math.abs(status.days)} days past due`
                        : status.days === 0
                          ? "Due today"
                          : `Due in ${status.days} days`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={readonly}
                  onClick={() => void togglePaid(bill)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    status.paid ? "bg-otto-green text-black" : "border border-otto-divider text-otto-text-dim"
                  }`}
                  aria-label={status.paid ? `Mark ${bill.name} unpaid` : `Mark ${bill.name} paid`}
                >
                  <Check size={16} />
                </button>
              </div>
              <button
                type="button"
                disabled={readonly}
                onClick={() => void remove(bill.id)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-otto-text-faint"
              >
                <Trash2 size={12} /> Remove
              </button>
            </article>
          );
        })}
        {!loading && ordered.length === 0 && (
          <p className="rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
            Add water, electric, cards, and the mortgage. Each one repeats on its day every month.
          </p>
        )}
      </div>
      {adding ? (
        <form
          className="mt-3 space-y-2 rounded-2xl bg-otto-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void addBill();
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Water, Visa, mortgage…" className="w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
          <div className="grid grid-cols-2 gap-2">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Amount" className="rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
            <input value={dueDay} onChange={(event) => setDueDay(event.target.value)} inputMode="numeric" placeholder="Due day" aria-label="Due day" className="rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]" />
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value as BillCategory)} className="w-full rounded-xl bg-otto-bg px-3 py-2.5 text-[14px]">
            {BILL_CATEGORIES.map((item) => (
              <option key={item} value={item}>{BILL_CATEGORY_LABEL[item]}</option>
            ))}
          </select>
          <button type="submit" disabled={readonly} className="w-full rounded-full bg-otto-green py-2.5 text-[13px] font-bold text-black disabled:opacity-40">
            Save bill
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-otto-surface py-3 text-[13px] font-bold">
          <Plus size={15} /> Add a bill
        </button>
      )}
    </section>
  );
}
