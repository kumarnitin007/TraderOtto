"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, LogOut, PenLine, Rows3, type LucideIcon } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { AlpacaStatus } from "@/components/ui/AlpacaStatus";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTrades } from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney, summarize } from "@/lib/pnl";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/positions", label: "Positions", icon: Rows3 },
  { href: "/log", label: "Log trade", icon: PenLine },
  { href: "/performance", label: "Performance", icon: LineChart },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { trades } = useTrades();
  const { user, signOut } = useAuth();
  const { allTime, mtd, wtd, winRate } = summarize(trades);

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
                {item.label}
              </Link>
            );
          })}
          <div className="mt-[34px] border-t border-otto-divider pt-5">
            <div className="mb-1.5 block text-xs font-medium text-otto-text-dim">All-time P/L</div>
            <div
              className={`text-[26px] font-extrabold ${allTime >= 0 ? "text-otto-green" : "text-otto-red"}`}
            >
              {allTime >= 0 ? "+" : ""}
              {fmtMoney(allTime)}
            </div>
            <div className="mt-3.5 flex flex-col items-start gap-2">
              <Pill label="Month" value={mtd} />
              <Pill label="Week" value={wtd} />
            </div>
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
            <div className="mt-2.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-0.5 block text-[11px] font-medium text-otto-text-dim">
                  All-time P/L
                </div>
                <div className="truncate text-[26px] font-extrabold leading-tight tracking-[-0.5px] text-otto-text">
                  {allTime >= 0 ? "+" : ""}
                  {fmtMoney(allTime)}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Pill label="Mo" value={mtd} />
                <Pill label="Wk" value={wtd} />
              </div>
            </div>
          </header>
          <div className="px-[18px] pt-3.5">{children}</div>
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
              className={`flex flex-1 flex-col items-center gap-[3px] px-0 pb-1 pt-1.5 ${
                active ? "text-otto-text" : "text-otto-text-faint"
              }`}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.3 : 1.8}
                className={active ? "text-otto-green" : "text-otto-text-faint"}
              />
              <span className="text-[10.5px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
