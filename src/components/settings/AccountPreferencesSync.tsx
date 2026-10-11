"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import {
  applyWorkspacePreferences,
  loadAccountSettings,
  readWorkspacePreferences,
  replaceTradeImportHistory,
  saveAccountSettings,
  THEME_CHANGED_EVENT,
} from "@/lib/accountPreferences";
import { BANKS_PREFERENCES_EVENT } from "@/lib/banksPreferences";
import { BOOKS_PREFERENCES_EVENT } from "@/lib/booksPreferences";
import { JOURNAL_PREFERENCES_EVENT } from "@/lib/journalPreferences";
import { SCREEN_OPTIONS_EVENT } from "@/lib/screenCache";
import { readTradeImportHistory } from "@/lib/tradeImportHistory";
import { getSupabaseClient } from "@/lib/supabase";

const CHANGE_EVENTS = [
  SCREEN_OPTIONS_EVENT,
  BOOKS_PREFERENCES_EVENT,
  JOURNAL_PREFERENCES_EVENT,
  BANKS_PREFERENCES_EVENT,
  THEME_CHANGED_EVENT,
  "otto-trade-imports",
];

/** Copies account preferences to this device on sign-in, then keeps later edits on the account. */
export function AccountPreferencesSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    const userId = user?.id;
    if (!userId || userId === "local-bypass") return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    let cancelled = false;
    let applying = true;
    let timer = 0;
    let last = "";

    const publish = () => {
      if (cancelled || applying) return;
      const snapshot = JSON.stringify({
        workspace: readWorkspacePreferences(),
        tradeImports: readTradeImportHistory(userId),
      });
      if (snapshot === last) return;
      last = snapshot;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveAccountSettings(supabase, userId).catch(() => {
          last = "";
        });
      }, 500);
    };

    void loadAccountSettings(supabase, userId)
      .then((remote) => {
        if (cancelled) return;
        if (remote.workspace) {
          applyWorkspacePreferences(remote.workspace);
          setTheme(remote.workspace.theme);
        }
        if (remote.tradeImports) replaceTradeImportHistory(userId, remote.tradeImports);
        applying = false;
        last = JSON.stringify({
          workspace: readWorkspacePreferences(),
          tradeImports: readTradeImportHistory(userId),
        });
        const missingWorkspace = !remote.workspace;
        const missingImports = !remote.tradeImports && readTradeImportHistory(userId).length > 0;
        if (missingWorkspace || missingImports) {
          last = "";
          publish();
        }
      })
      .catch(() => {
        applying = false;
      });

    for (const event of CHANGE_EVENTS) window.addEventListener(event, publish);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      for (const event of CHANGE_EVENTS) window.removeEventListener(event, publish);
    };
  }, [setTheme, user?.id]);

  return null;
}
