"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LineChart,
  LogOut,
  PenLine,
  Rows3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { AlpacaStatus } from "@/components/ui/AlpacaStatus";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PnlOverview } from "@/components/nav/PnlOverview";
import { useTrades } from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { useNotifications } from "@/hooks/useNotifications";
import { summarize } from "@/lib/pnl";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/positions", label: "Positions", icon: Rows3 },
  { href: "/log", label: "Log trade", icon: PenLine },
  { href: "/performance", label: "Performance", icon: LineChart },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { trades, error: tradeError, readonly } = useTrades();
  const { error: groupError } = useWatchGroups();
  const { user, signOut } = useAuth();
  const { unreadCount, error: notificationError } = useNotifications();
  const { winRate } = summarize(trades);

  return (
    <div className="min-h-screen bg-otto-bg text-otto-text">
      <div className="mx-auto flex max-w-[1180px]">
        <aside className="hidden min-h-screen w-[236px] shrink-0 flex-col border-r border-otto-divider px-5 py-7 desk:flex">
          <div className="text-[19px] font-extrabold tracking-[-0.3px]">Trader Otto</div>
          <div className="mb-[30px] mt-[3px] text-[12.5px] text-otto-text-faint">
            Options trade journal
          </div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex w-full items-center gap-[11px] rounded-[10px] px-2 py-2.5 text-left text-[14.5px] font-semibold ${
                  active ? "bg-otto-surface text-otto-text" : "text-otto-text-dim"
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={2.2}
                  className={active ? "text-otto-green" : "text-otto-text-faint"}
                />
                <span className="flex-1">{item.label}</span>
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="rounded-full bg-otto-red-soft px-1.5 py-0.5 text-[10px] text-otto-red">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="mt-[34px] border-t border-otto-divider pt-5">
            <PnlOverview />
            <div className="mt-4">
              <div className="mb-1.5 block text-xs font-medium text-otto-text-dim">Win rate</div>
              <div className="text-lg font-bold">{winRate == null ? "—" : `${winRate}%`}</div>
            </div>
          </div>
          <AlpacaStatus />
          <div className="mt-2">
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
          >
            <LogOut size={13} />
            Log out
            {user?.method === "demo" ? " · demo" : ""}
          </button>
        </aside>

        <main className="min-w-0 flex-1 pb-24 desk:px-2 desk:pt-7">
          <header className="sticky top-0 z-[5] bg-otto-bg px-[18px] pb-2.5 pt-4 desk:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[17px] font-bold tracking-[-0.2px]">Trader Otto</div>
              <div className="flex shrink-0 items-center gap-1.5">
                <AlpacaStatus compact />
                <ThemeToggle compact />
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-otto-divider text-otto-text-dim"
                  aria-label="Log out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
            <PnlOverview compact />
          </header>
          <div className="px-[18px] pt-3.5">
            {(readonly || tradeError || groupError || notificationError) && (
              <div
                className={`mb-4 rounded-xl border px-3 py-2 text-xs ${
                  tradeError || groupError || notificationError
                    ? "border-otto-red/30 bg-otto-red-soft text-otto-red"
                    : "border-otto-amber/30 bg-otto-amber-soft text-otto-amber"
                }`}
              >
                {tradeError ||
                  groupError ||
                  notificationError ||
                  "Bypass mode is view-only. Sign in to load and save database records."}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t border-otto-divider bg-otto-bg/90 px-2 pb-[calc(9px+env(safe-area-inset-bottom))] pt-[9px] backdrop-blur-[14px] desk:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-[3px] px-0 pb-1 pt-1.5 ${
                active ? "text-otto-text" : "text-otto-text-faint"
              }`}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.3 : 1.8}
                className={active ? "text-otto-green" : "text-otto-text-faint"}
              />
              <span className="text-[10.5px] font-semibold">{item.label}</span>
              {item.href === "/notifications" && unreadCount > 0 && (
                <span className="absolute left-1/2 top-0 ml-2 rounded-full bg-otto-red px-1 text-[9px] font-bold text-black">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
