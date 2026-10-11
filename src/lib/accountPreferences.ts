import type { SupabaseClient } from "@supabase/supabase-js";
import { readBanksPreferences, writeBanksPreferences, type BanksPreferences } from "@/lib/banksPreferences";
import {
  normalizeBooksPreferences,
  readBooksPreferences,
  writeBooksPreferences,
  type BooksPreferences,
} from "@/lib/booksPreferences";
import {
  readJournalPreferences,
  writeJournalPreferences,
  type JournalPrefs,
} from "@/lib/journalPreferences";
import { readScreenOptions, updateScreenOptions } from "@/lib/screenCache";
import {
  readTradeImportHistory,
  writeTradeImportHistory,
  type TradeImportRecord,
} from "@/lib/tradeImportHistory";
import {
  normalizeDefaultSection,
  normalizeEnabledSections,
} from "@/lib/sectionPreferences";
import type { AppWorkspace } from "@/lib/appWorkspace";
import { milestoneWindow, type MilestoneWindow } from "@/lib/life";
import type { TradeScope } from "@/lib/tradeScope";

export const THEME_CHANGED_EVENT = "trader-otto:theme-changed";

export type AccountTheme = "warm-paper" | "dark";

/** Preferences that follow the account. The last open screen in each workspace stays on the device. */
export type WorkspacePreferences = {
  theme: AccountTheme;
  tradeScope: TradeScope;
  enabledSections: AppWorkspace[];
  defaultSection: AppWorkspace;
  booksOpenLibraryEnabled: boolean;
  lifeMilestoneWindow: MilestoneWindow;
  books: BooksPreferences;
  journal: JournalPrefs;
  banks: BanksPreferences;
};

const THEME_COOKIE = "trader-otto-theme";

export function readAccountTheme(): AccountTheme {
  if (typeof document === "undefined") return "warm-paper";
  const saved = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${THEME_COOKIE}=`))
    ?.split("=")[1];
  return saved === "dark" ? "dark" : "warm-paper";
}

export function readWorkspacePreferences(): WorkspacePreferences {
  const screen = readScreenOptions();
  return {
    theme: readAccountTheme(),
    tradeScope: screen.tradeScope,
    enabledSections: screen.enabledSections,
    defaultSection: screen.defaultSection,
    booksOpenLibraryEnabled: screen.booksOpenLibraryEnabled,
    lifeMilestoneWindow: screen.lifeMilestoneWindow,
    books: readBooksPreferences(),
    journal: readJournalPreferences(),
    banks: readBanksPreferences(),
  };
}

export function applyWorkspacePreferences(prefs: WorkspacePreferences) {
  updateScreenOptions({
    tradeScope: prefs.tradeScope,
    enabledSections: prefs.enabledSections,
    defaultSection: prefs.defaultSection,
    booksOpenLibraryEnabled: prefs.booksOpenLibraryEnabled,
    lifeMilestoneWindow: prefs.lifeMilestoneWindow,
  });
  writeBooksPreferences(prefs.books);
  writeJournalPreferences(prefs.journal);
  writeBanksPreferences(prefs.banks);
}

export function parseWorkspacePreferences(value: unknown): WorkspacePreferences | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const enabledSections = normalizeEnabledSections(raw.enabledSections);
  const books = readBooksShape(raw.books);
  const journal = readJournalShape(raw.journal);
  const banks = readBanksShape(raw.banks);
  if (!books || !journal || !banks) return null;
  return {
    theme: raw.theme === "dark" ? "dark" : "warm-paper",
    tradeScope: raw.tradeScope === "credit_spreads" ? "credit_spreads" : "all",
    enabledSections,
    defaultSection: normalizeDefaultSection(raw.defaultSection, enabledSections),
    booksOpenLibraryEnabled: raw.booksOpenLibraryEnabled !== false,
    lifeMilestoneWindow: milestoneWindow(raw.lifeMilestoneWindow),
    books,
    journal,
    banks,
  };
}

function readBooksShape(value: unknown): BooksPreferences | null {
  if (!value || typeof value !== "object") return null;
  return normalizeBooksPreferences(value);
}

function readJournalShape(value: unknown): JournalPrefs | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<JournalPrefs>;
  return {
    showStreak: row.showStreak !== false,
    promptOfDay: row.promptOfDay !== false,
    suggestTags: row.suggestTags === true,
  };
}

function readBanksShape(value: unknown): BanksPreferences | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BanksPreferences>;
  const rate = Number(row.inrPerUsd);
  return {
    home: row.home === "INR" ? "INR" : "USD",
    inrPerUsd: Number.isFinite(rate) && rate > 0 ? rate : null,
  };
}

export function parseTradeImportHistory(value: unknown): TradeImportRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records = value.filter(isTradeImportRecord).slice(0, 8);
  return records;
}

function isTradeImportRecord(value: unknown): value is TradeImportRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TradeImportRecord>;
  return (
    typeof row.id === "string" &&
    typeof row.at === "string" &&
    typeof row.fileName === "string" &&
    typeof row.undone === "boolean" &&
    Array.isArray(row.createdIds) &&
    Array.isArray(row.before) &&
    Array.isArray(row.removed) &&
    Array.isArray(row.unmatched)
  );
}

export async function loadAccountSettings(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tr_profiles")
    .select("settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings = settingsObject(data?.settings);
  return {
    workspace: parseWorkspacePreferences(settings.workspace),
    tradeImports: parseTradeImportHistory(settings.tradeImports),
  };
}

export async function saveAccountSettings(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tr_profiles")
    .select("settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings = settingsObject(data?.settings);
  const { error: writeError } = await supabase.from("tr_profiles").upsert({
    id: userId,
    settings: {
      ...settings,
      workspace: readWorkspacePreferences(),
      tradeImports: readTradeImportHistory(userId),
    },
  });
  if (writeError) throw new Error(writeError.message);
}

export function replaceTradeImportHistory(userId: string, records: TradeImportRecord[]) {
  writeTradeImportHistory(userId, records);
}

function settingsObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
