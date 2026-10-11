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
import { THEME_CHANGED_EVENT } from "@/lib/accountPreferences";

export type Theme = "dark" | "warm-paper";

const COOKIE_KEY = "trader-otto-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSavedTheme(): Theme {
  if (typeof document === "undefined") return "warm-paper";
  const saved = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_KEY}=`))
    ?.split("=")[1];
  return saved === "dark" ? "dark" : "warm-paper";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readSavedTheme);

  useEffect(() => {
    const next = readSavedTheme();
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const applyTheme = useCallback((next: Theme) => {
    document.cookie = `${COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.dataset.theme = next;
    setTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme: applyTheme,
      toggleTheme: () => applyTheme(theme === "dark" ? "warm-paper" : "dark"),
    }),
    [applyTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
