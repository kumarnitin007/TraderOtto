/** Browser cache for UI screen options only — not trades or groups. */

import type { PnlRange } from "@/lib/pnl";

export const SCREEN_CACHE_KEY = "trader-otto:screen-options";

export type ScreenOptions = {
  positionsView: string;
  positionsFilter: "open" | "closed" | "all";
  logMode: "new" | "edit" | "groups";
  logEditFilter: "open" | "closed";
  performancePeriod: "weekly" | "monthly";
  collapsedGroups: Record<string, boolean>;
  pnlRange: PnlRange;
  performanceUnrealized: boolean;
  performanceView: "overview" | "ticker";
  performanceTicker: string;
};

export const SCREEN_OPTION_DEFAULTS: ScreenOptions = {
  positionsView: "positions",
  positionsFilter: "open",
  logMode: "new",
  logEditFilter: "open",
  performancePeriod: "monthly",
  collapsedGroups: {},
  pnlRange: "all",
  performanceUnrealized: false,
  performanceView: "overview",
  performanceTicker: "",
};

function isFilter(value: unknown): value is ScreenOptions["positionsFilter"] {
  return value === "open" || value === "closed" || value === "all";
}

function isLogMode(value: unknown): value is ScreenOptions["logMode"] {
  return value === "new" || value === "edit" || value === "groups";
}

function isPerformanceView(value: unknown): value is ScreenOptions["performanceView"] {
  return value === "overview" || value === "ticker";
}

function isPnlRange(value: unknown): value is PnlRange {
  return (
    value === "month" ||
    value === "ytd" ||
    value === "year" ||
    value === "5y" ||
    value === "all"
  );
}

export function readScreenOptions(): ScreenOptions {
  if (typeof window === "undefined") return SCREEN_OPTION_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SCREEN_CACHE_KEY);
    if (!raw) return SCREEN_OPTION_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ScreenOptions>;
    return {
      positionsView:
        typeof parsed.positionsView === "string"
          ? parsed.positionsView
          : SCREEN_OPTION_DEFAULTS.positionsView,
      positionsFilter: isFilter(parsed.positionsFilter)
        ? parsed.positionsFilter
        : SCREEN_OPTION_DEFAULTS.positionsFilter,
      logMode: isLogMode(parsed.logMode) ? parsed.logMode : SCREEN_OPTION_DEFAULTS.logMode,
      logEditFilter: parsed.logEditFilter === "closed" ? "closed" : "open",
      performancePeriod: parsed.performancePeriod === "weekly" ? "weekly" : "monthly",
      collapsedGroups:
        parsed.collapsedGroups && typeof parsed.collapsedGroups === "object"
          ? parsed.collapsedGroups
          : {},
      pnlRange: isPnlRange(parsed.pnlRange) ? parsed.pnlRange : SCREEN_OPTION_DEFAULTS.pnlRange,
      performanceUnrealized: parsed.performanceUnrealized === true,
      performanceView: isPerformanceView(parsed.performanceView)
        ? parsed.performanceView
        : SCREEN_OPTION_DEFAULTS.performanceView,
      performanceTicker:
        typeof parsed.performanceTicker === "string"
          ? parsed.performanceTicker
          : "",
    };
  } catch {
    return SCREEN_OPTION_DEFAULTS;
  }
}

export function writeScreenOptions(next: ScreenOptions) {
  window.localStorage.setItem(SCREEN_CACHE_KEY, JSON.stringify(next));
}
