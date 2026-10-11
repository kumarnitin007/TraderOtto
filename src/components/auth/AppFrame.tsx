"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AlpacaConnectionProvider } from "@/components/alpaca/AlpacaConnectionProvider";
import { WatchGroupsProvider } from "@/hooks/useWatchGroups";
import { TradesProvider } from "@/hooks/useTrades";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { NotificationEngine } from "@/hooks/useNotificationEngine";
import { MarketSessionProvider } from "@/hooks/useMarketSession";
import { LiveMarketProvider } from "@/hooks/useLiveMarket";
import { AppShell } from "@/components/nav/AppShell";
import { AccountPreferencesSync } from "@/components/settings/AccountPreferencesSync";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/auth/callback")) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <MarketSessionProvider>
        <AlpacaConnectionProvider>
          <WatchGroupsProvider>
            <TradesProvider>
              <LiveMarketProvider>
                <NotificationsProvider>
                  <NotificationEngine />
                  <AccountPreferencesSync />
                  <AppShell>{children}</AppShell>
                </NotificationsProvider>
              </LiveMarketProvider>
            </TradesProvider>
          </WatchGroupsProvider>
        </AlpacaConnectionProvider>
      </MarketSessionProvider>
    </AuthGate>
  );
}
