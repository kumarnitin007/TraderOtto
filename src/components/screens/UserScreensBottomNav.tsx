"use client";

import { Home, Settings } from "lucide-react";
import { ModuleNav, type ModuleNavItem } from "@/components/nav/ModuleNav";
import { screenIcon } from "@/lib/userScreenIcons";
import type { UserScreen } from "@/types/userScreens";

export function UserScreensBottomNav({
  lists,
  active,
  onTab,
}: {
  lists: UserScreen[];
  active: string;
  onTab: (tab: string) => void;
}) {
  const tabs: ModuleNavItem<string>[] = [
    { id: "overview", label: "Home", icon: Home },
    ...lists.map((list) => ({ id: list.id, label: list.name, icon: screenIcon(list.icon, list.name) })),
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return <ModuleNav workspace="screens" label="User Screens tabs" items={tabs} active={active} onSelect={onTab} />;
}
