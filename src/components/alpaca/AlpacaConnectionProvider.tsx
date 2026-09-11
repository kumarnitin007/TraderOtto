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
import { connectionCheckMs } from "@/lib/marketSession";
import { authHeaders } from "@/lib/authHeaders";
import { useMarketSession } from "@/hooks/useMarketSession";

export type AlpacaConnectionState = "checking" | "live" | "offline";

type AlpacaConnectionValue = {
  state: AlpacaConnectionState;
  checkConnection: (opts?: { quiet?: boolean }) => Promise<void>;
};

const AlpacaConnectionContext = createContext<AlpacaConnectionValue | null>(null);

export function AlpacaConnectionProvider({ children }: { children: ReactNode }) {
  const { schedule, visible } = useMarketSession();
  const [state, setState] = useState<AlpacaConnectionState>("checking");

  const checkConnection = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setState("checking");
    try {
      const response = await fetch("/api/quotes?symbols=SPY", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      if (!response.ok) {
        setState("offline");
        return;
      }
      const data = (await response.json()) as { source?: string };
      if (data.source === "alpaca") setState("live");
      else setState("offline");
    } catch {
      setState("offline");
    }
  }, []);

  const checkEvery = connectionCheckMs(schedule);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(
      () => void checkConnection({ quiet: true }),
      checkEvery
    );
    return () => window.clearInterval(id);
  }, [checkConnection, visible, checkEvery]);

  const value = useMemo(() => ({ state, checkConnection }), [state, checkConnection]);

  return (
    <AlpacaConnectionContext.Provider value={value}>{children}</AlpacaConnectionContext.Provider>
  );
}

export function useAlpacaConnection() {
  const context = useContext(AlpacaConnectionContext);
  if (!context) {
    throw new Error("useAlpacaConnection must be used within AlpacaConnectionProvider");
  }
  return context;
}
