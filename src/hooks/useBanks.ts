"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createSupabaseBankRepository } from "@/lib/data/supabaseBankRepository";
import { getSupabaseClient } from "@/lib/supabase";
import type { BankAccount, BankAccountInput, BankDeposit, BankDepositInput } from "@/types/bank";

function schemaMessage(message: string) {
  return /nw_accounts|nw_deposits|schema cache/i.test(message)
    ? "Run the Banks table script in Supabase, then reload."
    : message;
}

export function useBanks() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [deposits, setDeposits] = useState<BankDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly ? createSupabaseBankRepository(supabase, user.id) : null;
  }, [readonly, user]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setAccounts([]);
      setDeposits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextAccounts, nextDeposits] = await Promise.all([
        repository.listAccounts(),
        repository.listDeposits(),
      ]);
      setAccounts(nextAccounts);
      setDeposits(nextDeposits);
      setError("");
    } catch (cause) {
      setError(schemaMessage(cause instanceof Error ? cause.message : "Could not load banks."));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveAccount(input: BankAccountInput, id?: string) {
    if (!repository) throw new Error("Sign in to save accounts.");
    const saved = await repository.saveAccount(input, id);
    setAccounts((current) =>
      id ? current.map((item) => (item.id === id ? saved : item)) : [...current, saved]
    );
  }

  async function removeAccount(id: string) {
    if (!repository) throw new Error("Sign in to delete accounts.");
    await repository.removeAccount(id);
    setAccounts((current) => current.filter((item) => item.id !== id));
  }

  async function saveDeposit(input: BankDepositInput, id?: string) {
    if (!repository) throw new Error("Sign in to save deposits.");
    const saved = await repository.saveDeposit(input, id);
    setDeposits((current) =>
      id ? current.map((item) => (item.id === id ? saved : item)) : [...current, saved]
    );
  }

  async function removeDeposit(id: string) {
    if (!repository) throw new Error("Sign in to delete deposits.");
    await repository.removeDeposit(id);
    setDeposits((current) => current.filter((item) => item.id !== id));
  }

  return {
    accounts,
    deposits,
    loading,
    error,
    readonly,
    saveAccount,
    removeAccount,
    saveDeposit,
    removeDeposit,
  };
}
