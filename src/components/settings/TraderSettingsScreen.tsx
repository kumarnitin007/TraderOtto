"use client";

import { Bell, Clock3, EyeOff, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { OttoPreferencesEntry } from "@/components/settings/OttoPreferences";
import {
  SettingsPageHeader,
  SettingsRow,
} from "@/components/settings/SettingsPrimitives";
import type { TraderSettingsSection } from "@/components/settings/NotificationSettings";
import { useNotifications } from "@/hooks/useNotifications";

export function TraderSettingsScreen({
  onOpen,
}: {
  onOpen: (section: TraderSettingsSection) => void;
}) {
  const { preferences } = useNotifications();
  const enabledAlerts = Object.values(preferences.events).filter((event) => event.enabled).length;
  const mutedCount = preferences.mutedTickers.length + preferences.mutedGroupIds.length;

  return (
    <section className="mx-auto w-full max-w-[760px]">
      <SettingsPageHeader
        eyebrow="Trader preferences"
        description="Tune alerts, timing, position risk, and trade data."
      />

      <div className="mt-5">
        <OttoPreferencesEntry />
      </div>

      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={Bell}
          label="Alerts & channels"
          detail={preferences.masterEnabled ? `${enabledAlerts} enabled` : "Paused"}
          onClick={() => onOpen("alerts")}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={EyeOff}
          label="Muted alerts"
          detail={mutedCount ? `${mutedCount} muted` : "None"}
          onClick={() => onOpen("muted")}
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={ShieldAlert}
          label="Position risk rules"
          detail={`${preferences.positionRiskThresholds.criticalStrikeDistancePct}% critical`}
          onClick={() => onOpen("risk")}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Clock3}
          label="Timing & quiet hours"
          detail={`${preferences.expiryDays}d before expiry`}
          onClick={() => onOpen("timing")}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={FileSpreadsheet}
          label="Import & export trades"
          detail="CSV"
          onClick={() => onOpen("data")}
        />
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-otto-text-faint">
        Changes save automatically to your private Trader Otto profile.
      </p>
    </section>
  );
}
