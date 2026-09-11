"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "warm-paper";

const COOKIE_KEY = "trader-otto-theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_KEY}=`))
      ?.split("=")[1];
    const next: Theme = saved === "warm-paper" ? "warm-paper" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        setTheme((current) => {
          const next = current === "dark" ? "warm-paper" : "dark";
          document.cookie = `${COOKIE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
          document.documentElement.dataset.theme = next;
          return next;
        });
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
