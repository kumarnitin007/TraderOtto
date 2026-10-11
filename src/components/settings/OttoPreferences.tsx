"use client";

import { useState } from "react";
import { Cloud, LogOut, MonitorSmartphone, Moon, Settings, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { SectionPreferenceEditor } from "@/components/settings/SectionPreferences";
import {
  SettingsDetailScreen,
  SettingsGroup,
  SettingsInfoRow,
  SettingsRow,
} from "@/components/settings/SettingsPrimitives";
import { useAuth } from "@/hooks/useAuth";
import { useScreenOption } from "@/hooks/useScreenOption";
import { APP_WORKSPACE_META } from "@/lib/appWorkspace";

const THEMES: { id: Theme; label: string }[] = [
  { id: "warm-paper", label: "Warm Paper" },
  { id: "dark", label: "Dark" },
];

export function OttoPreferencesEntry() {
  const [open, setOpen] = useState(false);
  const [enabledSections] = useScreenOption("enabledSections");
  const [defaultSection] = useScreenOption("defaultSection");
  const { theme } = useTheme();
  const home = APP_WORKSPACE_META[defaultSection];
  const themeLabel = theme === "dark" ? "Dark" : "Warm Paper";

  return (
    <>
      <div className="mb-5 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={Settings}
          label="Otto preferences"
          detail={`${themeLabel} · ${enabledSections.length} sections · ${home.label}`}
          onClick={() => setOpen(true)}
        />
      </div>
      {open && (
        <SettingsDetailScreen
          title="Otto preferences"
          eyebrow="Every workspace"
          onClose={() => setOpen(false)}
        >
          <OttoPreferencesBody />
        </SettingsDetailScreen>
      )}
    </>
  );
}

function OttoPreferencesBody() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [tradeScope, setTradeScope] = useScreenOption("tradeScope");

  return (
    <div className="space-y-5">
      <SettingsGroup title="Appearance">
        <div className="flex gap-2 p-3.5">
          {THEMES.map((choice) => {
            const selected = theme === choice.id;
            const Icon = choice.id === "dark" ? Moon : Sun;
            return (
              <button
                key={choice.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(choice.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-[13px] font-bold ${
                  selected ? "bg-otto-text text-otto-bg" : "bg-otto-bg text-otto-text-dim"
                }`}
              >
                <Icon size={15} />
                {choice.label}
              </button>
            );
          })}
        </div>
      </SettingsGroup>

      <section>
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">
          Sections
        </p>
        <SectionPreferenceEditor />
      </section>

      <SettingsGroup title="Trader view">
        <div className="p-3.5">
          <p className="text-[12px] leading-relaxed text-otto-text-dim">
            This filter changes Positions, Performance, and the sidebar summary on this device.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={tradeScope === "all"}
              onClick={() => setTradeScope("all")}
              className={`rounded-full px-3 py-2.5 text-[13px] font-bold ${
                tradeScope === "all" ? "bg-otto-text text-otto-bg" : "bg-otto-bg text-otto-text-dim"
              }`}
            >
              All trades
            </button>
            <button
              type="button"
              aria-pressed={tradeScope === "credit_spreads"}
              onClick={() => setTradeScope("credit_spreads")}
              className={`rounded-full px-3 py-2.5 text-[13px] font-bold ${
                tradeScope === "credit_spreads"
                  ? "bg-otto-text text-otto-bg"
                  : "bg-otto-bg text-otto-text-dim"
              }`}
            >
              Spreads only
            </button>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Where data is kept">
        <SettingsInfoRow
          icon={Cloud}
          label="Saved with your account"
          detail="Trades, alerts, vault, books, journal, life, and banks"
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsInfoRow
          icon={MonitorSmartphone}
          label="Kept on this device"
          detail="Theme, visible sections, home, and display filters"
        />
      </SettingsGroup>

      <button
        type="button"
        onClick={() => void signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-otto-divider bg-otto-surface px-4 py-2.5 text-xs font-bold text-otto-text-dim"
      >
        <LogOut size={14} />
        Log out{user?.method === "demo" ? " · demo" : ""}
      </button>
    </div>
  );
}
