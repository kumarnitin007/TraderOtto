"use client";

import { Bell, Clock3, EyeOff, ShieldAlert } from "lucide-react";
import { SettingsRow } from "@/components/settings/SettingsPrimitives";
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Trader preferences
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Settings</h1>
      <p className="mt-0.5 text-[13px] text-otto-text-dim">
        Tune alerts, timing, and position risk in focused sections.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
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
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-otto-text-faint">
        Changes save automatically to your private Trader Otto profile.
      </p>
    </section>
  );
}
