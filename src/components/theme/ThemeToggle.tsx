"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isWarm = theme === "warm-paper";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center gap-1.5 rounded-full border border-otto-divider bg-otto-surface font-semibold text-otto-text-dim transition-colors hover:bg-otto-surface-raise ${
        compact ? "h-7 px-2 text-[11px]" : "px-3 py-2 text-xs"
      }`}
      aria-label={isWarm ? "Switch to dark theme" : "Switch to Warm Paper theme"}
      title={isWarm ? "Switch to dark theme" : "Switch to Warm Paper theme"}
    >
      {isWarm ? <Moon size={13} /> : <Sun size={13} />}
      {!compact && (isWarm ? "Dark" : "Warm Paper")}
    </button>
  );
}
