"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";
import { createSupabaseTradeRepository } from "@/lib/data/supabaseTradeRepository";
import type {
  ClosedTradeImport,
  ClosePayload,
  NewTrade,
  Trade,
  TradeUpdate,
} from "@/types/trade";

type TradesContextValue = {
  trades: Trade[];
  loading: boolean;
  error: string;
  readonly: boolean;
  addTrade: (trade: NewTrade) => Promise<Trade>;
  addClosedTrade: (
    trade: ClosedTradeImport,
    allowDuplicate?: boolean
  ) => Promise<Trade>;
  updateTrade: (id: string, trade: TradeUpdate) => Promise<Trade>;
  closeTrade: (id: string, payload: ClosePayload) => Promise<Trade>;
  deleteTrade: (id: string) => Promise<void>;
};

const TradesContext = createContext<TradesContextValue | null>(null);

export function TradesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly
      ? createSupabaseTradeRepository(supabase, user.id)
      : null;
  }, [readonly, user]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (!repository) {
      setTrades([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    repository
      .list()
      .then((list) => {
        if (!cancelled) setTrades(list);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setTrades([]);
          setError(cause instanceof Error ? cause.message : "Could not load trades.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const addTrade = useCallback(async (trade: NewTrade) => {
    if (!repository) throw new Error("Sign in to save trades.");
    const created = await repository.add(trade);
    setTrades((prev) => [created, ...prev]);
    return created;
  }, [repository]);

  const addClosedTrade = useCallback(async (
    trade: ClosedTradeImport,
    allowDuplicate = false
  ) => {
    if (!repository) throw new Error("Sign in to save trades.");
    const created = await repository.addClosed(trade, allowDuplicate);
    setTrades((prev) => [created, ...prev]);
    return created;
  }, [repository]);

  const closeTrade = useCallback(async (id: string, payload: ClosePayload) => {
    if (!repository) throw new Error("Sign in to update trades.");
    const updated = await repository.close(id, payload);
    setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, [repository]);

  const updateTrade = useCallback(async (id: string, trade: TradeUpdate) => {
    if (!repository) throw new Error("Sign in to update trades.");
    const updated = await repository.update(id, trade);
    setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, [repository]);

  const deleteTrade = useCallback(async (id: string) => {
    if (!repository) throw new Error("Sign in to delete trades.");
    await repository.remove(id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, [repository]);

  const value = useMemo(
    () => ({
      trades,
      loading,
      error,
      readonly,
      addTrade,
      addClosedTrade,
      updateTrade,
      closeTrade,
      deleteTrade,
    }),
    [
      trades,
      loading,
      error,
      readonly,
      addTrade,
      addClosedTrade,
      updateTrade,
      closeTrade,
      deleteTrade,
    ]
  );

  return <TradesContext.Provider value={value}>{children}</TradesContext.Provider>;
}

export function useTrades() {
  const ctx = useContext(TradesContext);
  if (!ctx) throw new Error("useTrades must be used within TradesProvider");
  return ctx;
}
