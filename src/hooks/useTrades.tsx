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
import { localTradeRepository } from "@/lib/data/localTradeRepository";
import type { ClosePayload, NewTrade, Trade } from "@/types/trade";

type TradesContextValue = {
  trades: Trade[];
  loading: boolean;
  addTrade: (trade: NewTrade) => Promise<Trade>;
  updateTrade: (id: string, trade: NewTrade) => Promise<Trade>;
  closeTrade: (id: string, payload: ClosePayload) => Promise<Trade>;
  deleteTrade: (id: string) => Promise<void>;
};

const TradesContext = createContext<TradesContextValue | null>(null);

export function TradesProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localTradeRepository.list().then((list) => {
      if (!cancelled) {
        setTrades(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTrade = useCallback(async (trade: NewTrade) => {
    const created = await localTradeRepository.add(trade);
    setTrades((prev) => [created, ...prev]);
    return created;
  }, []);

  const closeTrade = useCallback(async (id: string, payload: ClosePayload) => {
    const updated = await localTradeRepository.close(id, payload);
    setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const updateTrade = useCallback(async (id: string, trade: NewTrade) => {
    const updated = await localTradeRepository.update(id, trade);
    setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const deleteTrade = useCallback(async (id: string) => {
    await localTradeRepository.remove(id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ trades, loading, addTrade, updateTrade, closeTrade, deleteTrade }),
    [trades, loading, addTrade, updateTrade, closeTrade, deleteTrade]
  );

  return <TradesContext.Provider value={value}>{children}</TradesContext.Provider>;
}

export function useTrades() {
  const ctx = useContext(TradesContext);
  if (!ctx) throw new Error("useTrades must be used within TradesProvider");
  return ctx;
}
