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

export type AlpacaConnectionState = "checking" | "live" | "simulated" | "offline";

type AlpacaConnectionValue = {
  state: AlpacaConnectionState;
  checkConnection: () => Promise<void>;
};

const AlpacaConnectionContext = createContext<AlpacaConnectionValue | null>(null);

export function AlpacaConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AlpacaConnectionState>("checking");

  const checkConnection = useCallback(async () => {
    setState("checking");
    try {
      const response = await fetch("/api/quote/SPY", { cache: "no-store" });
      if (!response.ok) {
        setState("offline");
        return;
      }
      const data = (await response.json()) as { source?: string };
      setState(data.source === "alpaca" ? "live" : "simulated");
    } catch {
      setState("offline");
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    const interval = window.setInterval(checkConnection, 60_000);
    return () => window.clearInterval(interval);
  }, [checkConnection]);

  const value = useMemo(() => ({ state, checkConnection }), [state, checkConnection]);

  return (
    <AlpacaConnectionContext.Provider value={value}>
      {children}
    </AlpacaConnectionContext.Provider>
  );
}

export function useAlpacaConnection() {
  const context = useContext(AlpacaConnectionContext);
  if (!context) {
    throw new Error("useAlpacaConnection must be used within AlpacaConnectionProvider");
  }
  return context;
}
