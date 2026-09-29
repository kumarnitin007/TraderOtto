"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createSupabaseBillRepository } from "@/lib/data/supabaseBillRepository";
import { getSupabaseClient } from "@/lib/supabase";
import type { Bill, BillInput } from "@/types/bill";

function schemaMessage(message: string) {
  return /lf_bills|schema cache/i.test(message)
    ? "Run the Life bills table script in Supabase, then reload."
    : message;
}

export function useBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly ? createSupabaseBillRepository(supabase, user.id) : null;
  }, [readonly, user]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setBills([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setBills(await repository.list());
      setError("");
    } catch (cause) {
      setError(schemaMessage(cause instanceof Error ? cause.message : "Could not load bills."));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save(input: BillInput, id?: string) {
    if (!repository) throw new Error("Sign in to save bills.");
    const saved = await repository.save(input, id);
    setBills((current) =>
      id ? current.map((bill) => (bill.id === id ? saved : bill)) : [...current, saved]
    );
  }

  async function remove(id: string) {
    if (!repository) throw new Error("Sign in to delete bills.");
    await repository.remove(id);
    setBills((current) => current.filter((bill) => bill.id !== id));
  }

  return { bills, loading, error, readonly, save, remove };
}
