"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { rowsNeedingSnapshot } from "@/lib/banksHistory";
import { createSupabaseBankRepository } from "@/lib/data/supabaseBankRepository";
import { todayISO } from "@/lib/pnl";
import { getSupabaseClient } from "@/lib/supabase";
import type { BankAccount, BankAccountInput, BankDeposit, BankDepositInput, BankSnapshot } from "@/types/bank";

function schemaMessage(message: string) {
  return /nw_accounts|nw_deposits|schema cache/i.test(message)
    ? "Run the Banks table script in Supabase, then reload."
    : message;
}

export function useBanks() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [snapshots, setSnapshots] = useState<BankSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyNote, setHistoryNote] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const accountsRef = useRef(accounts);
  const depositsRef = useRef(deposits);
  const snapshotsRef = useRef(snapshots);
  accountsRef.current = accounts;
  depositsRef.current = deposits;
  snapshotsRef.current = snapshots;
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly ? createSupabaseBankRepository(supabase, user.id) : null;
  }, [readonly, user]);

  const remember = useCallback(async (nextAccounts: BankAccount[], nextDeposits: BankDeposit[]) => {
    if (!repository) return;
    const pending = rowsNeedingSnapshot(snapshotsRef.current, nextAccounts, nextDeposits, todayISO());
    if (!pending.length) return;
    try {
      await repository.addSnapshots(pending);
      const stored = await repository.listSnapshots();
      snapshotsRef.current = stored;
      setSnapshots(stored);
      setHistoryNote("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setHistoryNote(
        /nw_snapshots|schema cache/i.test(message)
          ? "Run the Banks history script in Supabase to keep growth."
          : "Could not save this balance change."
      );
    }
  }, [repository]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setAccounts([]);
      setDeposits([]);
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextAccounts, nextDeposits] = await Promise.all([
        repository.listAccounts(),
        repository.listDeposits(),
      ]);
      accountsRef.current = nextAccounts;
      depositsRef.current = nextDeposits;
      setAccounts(nextAccounts);
      setDeposits(nextDeposits);
      setError("");
      try {
        const stored = await repository.listSnapshots();
        snapshotsRef.current = stored;
        setSnapshots(stored);
        setHistoryNote("");
        await remember(nextAccounts, nextDeposits);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "";
        setHistoryNote(/nw_snapshots|schema cache/i.test(message) ? "Run the Banks history script in Supabase to keep growth." : "");
      }
    } catch (cause) {
      setError(schemaMessage(cause instanceof Error ? cause.message : "Could not load banks."));
    } finally {
      setLoading(false);
    }
  }, [remember, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveAccount(input: BankAccountInput, id?: string) {
    if (!repository) throw new Error("Sign in to save accounts.");
    const saved = await repository.saveAccount(input, id);
    const next = id
      ? accountsRef.current.map((item) => (item.id === id ? saved : item))
      : [...accountsRef.current, saved];
    accountsRef.current = next;
    setAccounts(next);
    await remember(next, depositsRef.current);
  }

  async function removeAccount(id: string) {
    if (!repository) throw new Error("Sign in to delete accounts.");
    await repository.removeAccount(id);
    const next = accountsRef.current.filter((item) => item.id !== id);
    accountsRef.current = next;
    setAccounts(next);
  }

  async function saveDeposit(input: BankDepositInput, id?: string) {
    if (!repository) throw new Error("Sign in to save deposits.");
    const saved = await repository.saveDeposit(input, id);
    const next = id
      ? depositsRef.current.map((item) => (item.id === id ? saved : item))
      : [...depositsRef.current, saved];
    depositsRef.current = next;
    setDeposits(next);
    await remember(accountsRef.current, next);
  }

  async function removeDeposit(id: string) {
    if (!repository) throw new Error("Sign in to delete deposits.");
    await repository.removeDeposit(id);
    const next = depositsRef.current.filter((item) => item.id !== id);
    depositsRef.current = next;
    setDeposits(next);
  }

  async function clearAll() {
    if (!repository) throw new Error("Sign in to delete bank data.");
    await repository.clearAll();
    accountsRef.current = [];
    depositsRef.current = [];
    snapshotsRef.current = [];
    setAccounts([]);
    setDeposits([]);
    setSnapshots([]);
  }

  return {
    accounts,
    deposits,
    snapshots,
    loading,
    error,
    historyNote,
    readonly,
    saveAccount,
    removeAccount,
    saveDeposit,
    removeDeposit,
    clearAll,
  };
}
