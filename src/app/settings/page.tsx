"use client";

import { useState } from "react";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import type { TraderSettingsSection } from "@/components/settings/NotificationSettings";
import { SettingsDetailScreen } from "@/components/settings/SettingsPrimitives";
import { TraderSettingsScreen } from "@/components/settings/TraderSettingsScreen";
import { TradeDataSettings } from "@/components/settings/TradeDataSettings";

const SECTION_META: Record<TraderSettingsSection, { title: string; eyebrow: string }> = {
  alerts: { title: "Alerts & channels", eyebrow: "Notification settings" },
  muted: { title: "Muted alerts", eyebrow: "Notification settings" },
  risk: { title: "Position risk rules", eyebrow: "Trading settings" },
  timing: { title: "Timing & quiet hours", eyebrow: "Notification settings" },
  data: { title: "Import & export", eyebrow: "Trade data" },
};

export default function SettingsPage() {
  const [section, setSection] = useState<TraderSettingsSection | null>(null);

  return (
    <>
      <TraderSettingsScreen onOpen={setSection} />
      {section && (
        <SettingsDetailScreen
          title={SECTION_META[section].title}
          eyebrow={SECTION_META[section].eyebrow}
          onClose={() => setSection(null)}
        >
          {section === "data" ? (
            <TradeDataSettings />
          ) : (
            <NotificationSettings section={section} />
          )}
        </SettingsDetailScreen>
      )}
    </>
  );
}
