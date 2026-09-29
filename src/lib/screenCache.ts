/** Browser cache for UI screen options only — not trades or groups. */

import { APP_WORKSPACES, isAppWorkspace, type AppWorkspace } from "@/lib/appWorkspace";
import {
  normalizeDefaultSection,
  normalizeEnabledSections,
} from "@/lib/sectionPreferences";
import type { PnlRange } from "@/lib/pnl";
import type { PositionFocusFilter } from "@/lib/positionFocus";
import type { TradeScope } from "@/lib/tradeScope";

export const SCREEN_CACHE_KEY = "trader-otto:screen-options";
export const SCREEN_OPTIONS_EVENT = "trader-otto:screen-options-changed";
export const LAND_ON_DEFAULT_KEY = "otto-land-on-default";

export type ScreenOptions = {
  positionsView: string;
  positionsFilter: "open" | "closed" | "all";
  positionsFocus: PositionFocusFilter;
  logMode: "new" | "edit" | "groups";
  logEditFilter: "open" | "closed";
  performancePeriod: "weekly" | "monthly";
  collapsedGroups: Record<string, boolean>;
  pnlRange: PnlRange;
  performanceUnrealized: boolean;
  performanceView: "overview" | "ticker" | "strategy";
  performanceTicker: string;
  portfolioReportLayout: "actions" | "board" | "detail";
  tradeScope: TradeScope;
  appWorkspace: AppWorkspace;
  enabledSections: AppWorkspace[];
  defaultSection: AppWorkspace;
  booksTab: "library" | "discover" | "add" | "stats" | "settings";
  booksFilter: string;
  booksOpenLibraryEnabled: boolean;
  lifeTab: "today" | "dates" | "tasks" | "lists" | "bills" | "settings";
  journalTab: "entries" | "notes" | "add" | "day" | "settings";
};

export const SCREEN_OPTION_DEFAULTS: ScreenOptions = {
  positionsView: "positions",
  positionsFilter: "open",
  positionsFocus: "focus",
  logMode: "new",
  logEditFilter: "open",
  performancePeriod: "monthly",
  collapsedGroups: {},
  pnlRange: "year",
  performanceUnrealized: false,
  performanceView: "overview",
  performanceTicker: "",
  portfolioReportLayout: "actions",
  tradeScope: "all",
  appWorkspace: "trader",
  enabledSections: [...APP_WORKSPACES],
  defaultSection: "trader",
  booksTab: "library",
  booksFilter: "reading",
  booksOpenLibraryEnabled: true,
  lifeTab: "today",
  journalTab: "entries",
};

function isFilter(value: unknown): value is ScreenOptions["positionsFilter"] {
  return value === "open" || value === "closed" || value === "all";
}

function isFocus(value: unknown): value is PositionFocusFilter {
  return (
    value === "focus" ||
    value === "near" ||
    value === "time" ||
    value === "losing" ||
    value === "all"
  );
}

function isLogMode(value: unknown): value is ScreenOptions["logMode"] {
  return value === "new" || value === "edit" || value === "groups";
}

function isPerformanceView(value: unknown): value is ScreenOptions["performanceView"] {
  return value === "overview" || value === "ticker" || value === "strategy";
}

function isReportLayout(
  value: unknown
): value is ScreenOptions["portfolioReportLayout"] {
  return value === "actions" || value === "board" || value === "detail";
}

function isPnlRange(value: unknown): value is PnlRange {
  return (
    value === "month" ||
    value === "week" ||
    value === "3m" ||
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
    const options: ScreenOptions = {
      positionsView:
        typeof parsed.positionsView === "string"
          ? parsed.positionsView
          : SCREEN_OPTION_DEFAULTS.positionsView,
      positionsFilter: isFilter(parsed.positionsFilter)
        ? parsed.positionsFilter
        : SCREEN_OPTION_DEFAULTS.positionsFilter,
      positionsFocus: isFocus(parsed.positionsFocus)
        ? parsed.positionsFocus
        : SCREEN_OPTION_DEFAULTS.positionsFocus,
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
      portfolioReportLayout: isReportLayout(parsed.portfolioReportLayout)
        ? parsed.portfolioReportLayout
        : SCREEN_OPTION_DEFAULTS.portfolioReportLayout,
      tradeScope:
        parsed.tradeScope === "credit_spreads" ? "credit_spreads" : "all",
      appWorkspace: isAppWorkspace(parsed.appWorkspace)
        ? parsed.appWorkspace
        : parsed.appWorkspace === "tasks"
          ? "life"
          : SCREEN_OPTION_DEFAULTS.appWorkspace,
      enabledSections: normalizeEnabledSections(parsed.enabledSections),
      defaultSection: normalizeDefaultSection(
        parsed.defaultSection,
        normalizeEnabledSections(parsed.enabledSections)
      ),
      booksTab:
        parsed.booksTab === "discover" ||
        parsed.booksTab === "add" ||
        parsed.booksTab === "stats" ||
        parsed.booksTab === "settings"
          ? parsed.booksTab
          : "library",
      booksFilter:
        typeof parsed.booksFilter === "string" &&
        /^[a-z0-9_-]{1,48}$/.test(parsed.booksFilter)
          ? parsed.booksFilter
          : "reading",
      booksOpenLibraryEnabled: parsed.booksOpenLibraryEnabled !== false,
      lifeTab:
        parsed.lifeTab === "dates" ||
        parsed.lifeTab === "tasks" ||
        parsed.lifeTab === "lists" ||
        parsed.lifeTab === "bills" ||
        parsed.lifeTab === "settings"
          ? parsed.lifeTab
          : "today",
      journalTab:
        parsed.journalTab === "notes" ||
        parsed.journalTab === "add" ||
        parsed.journalTab === "day" ||
        parsed.journalTab === "settings"
          ? parsed.journalTab
          : "entries",
    };
    if (!options.enabledSections.includes(options.appWorkspace)) {
      options.appWorkspace = options.defaultSection;
    }
    return options;
  } catch {
    return SCREEN_OPTION_DEFAULTS;
  }
}

export function writeScreenOptions(next: ScreenOptions) {
  window.localStorage.setItem(SCREEN_CACHE_KEY, JSON.stringify(next));
}

export function updateScreenOptions(patch: Partial<ScreenOptions>) {
  writeScreenOptions({ ...readScreenOptions(), ...patch });
  window.dispatchEvent(new Event(SCREEN_OPTIONS_EVENT));
}

export function applyDefaultSection() {
  const options = readScreenOptions();
  if (options.appWorkspace === options.defaultSection) return;
  updateScreenOptions({ appWorkspace: options.defaultSection });
}
