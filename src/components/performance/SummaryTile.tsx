"use client";

import { fmtMoney } from "@/lib/pnl";

export function SummaryTile({
  label,
  value,
  display,
}: {
  label: string;
  value: number | null;
  display?: string;
}) {
  const positive = value === null ? true : value >= 0;
  return (
    <div className="rounded-xl bg-otto-surface px-3.5 py-[13px]">
      <div className="mb-[5px] text-[11px] text-otto-text-faint">{label}</div>
      <div
        className={`text-[17px] font-bold ${
          value === null ? "text-otto-text" : positive ? "text-otto-green" : "text-otto-red"
        }`}
      >
        {display ??
          (value === null ? "—" : `${positive ? "+" : ""}${fmtMoney(value)}`)}
      </div>
    </div>
  );
}
