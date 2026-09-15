"use client";

import { useOptionMarks } from "@/hooks/useOptionMarks";
import { useTrades } from "@/hooks/useTrades";
import { fmtMoney, realizedInRange, unrealizedFromMarks } from "@/lib/pnl";

function moneyClass(value: number) {
  return value >= 0 ? "text-otto-green" : "text-otto-red";
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${fmtMoney(value)}`;
}

export function PnlOverview({ compact = false }: { compact?: boolean }) {
  const { trades } = useTrades();
  const marks = useOptionMarks(trades);
  const realized = realizedInRange(trades, "all");
  const unrealized = unrealizedFromMarks(trades, marks);

  return (
    <div
      className={`flex items-end justify-between gap-3 ${compact ? "mt-2.5" : ""}`}
    >
      <PnlStat
        compact={compact}
        label="Unrealized"
        value={unrealized}
        align="left"
      />
      <PnlStat
        compact={compact}
        label="Realized"
        value={realized}
        align="right"
      />
    </div>
  );
}

function PnlStat({
  compact,
  label,
  value,
  align,
}: {
  compact: boolean;
  label: string;
  value: number | null;
  align: "left" | "right";
}) {
  return (
    <div className={`min-w-0 flex-1 ${align === "right" ? "text-right" : "text-left"}`}>
      <div
        className={`mb-0.5 block font-medium text-otto-text-dim ${
          compact ? "text-[11px]" : "mb-1.5 text-xs"
        }`}
      >
        {label}
      </div>
      <div
        className={`font-extrabold leading-tight tracking-[-0.5px] ${
          compact ? "truncate text-[26px]" : "text-[17px] tabular-nums"
        } ${value == null ? "text-otto-text-faint" : moneyClass(value)}`}
      >
        {value == null ? "—" : formatSigned(value)}
      </div>
    </div>
  );
}
