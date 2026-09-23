"use client";

import { Home, Settings, ShieldCheck, type LucideIcon } from "lucide-react";

export type VaultTab = "vault" | "security" | "settings";

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-[3px] px-0 pb-1 pt-1.5 ${
        active ? "text-otto-text" : "text-otto-text-faint"
      }`}
    >
      <span className="relative">
        <Icon
          size={21}
          strokeWidth={active ? 2.3 : 1.8}
          className={active ? "text-otto-green" : "text-otto-text-faint"}
        />
        {badge != null && badge > 0 && (
          <em className="absolute -right-2.5 -top-1 min-w-[15px] rounded-full bg-otto-red px-1 text-center text-[9px] font-bold not-italic text-black">
            {badge}
          </em>
        )}
      </span>
      <small className="text-[10.5px] font-semibold">{label}</small>
    </button>
  );
}

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
    <nav
      aria-label="Vault navigation"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-otto-divider bg-otto-bg/90 px-2 pb-[calc(9px+env(safe-area-inset-bottom))] pt-[9px] backdrop-blur-[14px] desk:static desk:mt-8 desk:rounded-2xl desk:border desk:bg-otto-surface desk:pb-2"
    >
      <div className="mx-auto flex max-w-[720px]">
        <NavButton
          icon={Home}
          label="Vault"
          active={tab === "vault"}
          onClick={() => onTab("vault")}
        />
        <NavButton
          icon={ShieldCheck}
          label="Security"
          active={tab === "security"}
          onClick={() => onTab("security")}
          badge={securityBadge}
        />
        <NavButton
          icon={Settings}
          label="Settings"
          active={tab === "settings"}
          onClick={() => onTab("settings")}
        />
      </div>
    </nav>
  );
}
