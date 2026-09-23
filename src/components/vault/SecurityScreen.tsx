"use client";

import {
  AlertTriangle,
  ChevronRight,
  Gauge,
  RefreshCw,
  WandSparkles,
  WifiOff,
} from "lucide-react";
import type { VaultSecuritySnapshot } from "@/lib/vaultSecurity";

export function SecurityScreen({
  security,
  onGenerate,
}: {
  security: VaultSecuritySnapshot;
  onGenerate: () => void;
}) {
  const tools = [
    {
      icon: WandSparkles,
      title: "Password generator",
      detail: "Create a strong, unique password",
      action: onGenerate,
      tone: "text-otto-green bg-otto-green-soft",
    },
    {
      icon: AlertTriangle,
      title: "Weak passwords",
      detail:
        security.weakCount > 0
          ? `${security.weakCount} password${security.weakCount === 1 ? "" : "s"} need attention`
          : "No weak passwords detected",
      badge: security.weakCount > 0 ? String(security.weakCount) : undefined,
      tone: "text-otto-amber bg-otto-amber-soft",
    },
    {
      icon: RefreshCw,
      title: "Reused passwords",
      detail:
        security.reusedCount > 0
          ? `${security.reusedCount} reused group${security.reusedCount === 1 ? "" : "s"} found`
          : "You're not reusing passwords",
      tone: "text-otto-green bg-otto-green-soft",
    },
    {
      icon: Gauge,
      title: "Security checkup",
      detail: "Based on items in this browser only",
      tone: "text-otto-text-dim bg-otto-surface-raise",
    },
  ];

  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Protection center
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Security</h1>
      <p className="mt-0.5 text-[13.5px] text-otto-text-dim">
        Small steps make your vault stronger.
      </p>

      <div className="mt-5 flex gap-4 rounded-2xl bg-otto-surface px-4 py-4">
        <div className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-otto-green bg-otto-bg">
          <span className="text-2xl font-extrabold">{security.score}</span>
          <small className="text-[10px] text-otto-text-dim">/ 100</small>
        </div>
        <div className="flex flex-col justify-center">
          <h2 className="text-lg font-bold">{security.label}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-otto-text-dim">
            {security.detail}
          </p>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-bold">Security tools</h2>
      <div className="flex flex-col gap-2">
        {tools.map((tool) => (
          <button
            key={tool.title}
            type="button"
            onClick={tool.action}
            className="flex w-full items-center gap-3 rounded-xl bg-otto-surface px-3 py-3 text-left"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tool.tone}`}
            >
              <tool.icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[14px]">{tool.title}</b>
              <small className="block text-[12px] text-otto-text-dim">{tool.detail}</small>
            </span>
            {tool.badge && (
              <em className="rounded-full bg-otto-red-soft px-2 py-0.5 text-[11px] font-bold not-italic text-otto-red">
                {tool.badge}
              </em>
            )}
            <ChevronRight size={18} className="shrink-0 text-otto-text-faint" />
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-otto-divider bg-otto-surface px-3.5 py-3">
        <WifiOff className="shrink-0 text-otto-text-dim" size={20} />
        <div>
          <b className="block text-[13.5px]">Private by design</b>
          <span className="text-[12.5px] text-otto-text-dim">
            This prototype vault stays on this device only.
          </span>
        </div>
      </div>
    </section>
  );
}
