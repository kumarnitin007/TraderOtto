"use client";

import { Home, Plus, Settings, ShieldCheck, Star } from "lucide-react";
import { ModuleNav } from "@/components/nav/ModuleNav";

export type VaultTab = "vault" | "favorites" | "add" | "security" | "settings";

export function VaultBottomNav({
  tab,
  onTab,
  securityBadge,
}: {
  tab: VaultTab;
  onTab: (tab: VaultTab) => void;
  securityBadge: number;
}) {
  return (
    <ModuleNav
      workspace="vault"
      label="Vault navigation"
      active={tab === "add" ? null : tab}
      onSelect={onTab}
      items={[
        { id: "vault", label: "Vault", icon: Home },
        { id: "favorites", label: "Favorites", icon: Star },
        { id: "add", label: "Add", icon: Plus },
        { id: "security", label: "Security", icon: ShieldCheck, badge: securityBadge },
        { id: "settings", label: "Settings", icon: Settings },
      ]}
    />
  );
}
