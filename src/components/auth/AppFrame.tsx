"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AlpacaConnectionProvider } from "@/components/alpaca/AlpacaConnectionProvider";
import { WatchGroupsProvider } from "@/hooks/useWatchGroups";
import { TradesProvider } from "@/hooks/useTrades";
import { AppShell } from "@/components/nav/AppShell";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/auth/callback")) {
    return <>{children}</>;
  }

  return (
    <AuthGate>
      <AlpacaConnectionProvider>
        <WatchGroupsProvider>
          <TradesProvider>
            <AppShell>{children}</AppShell>
          </TradesProvider>
        </WatchGroupsProvider>
      </AlpacaConnectionProvider>
    </AuthGate>
  );
}
