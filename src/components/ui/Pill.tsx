"use client";

import { fmtMoney } from "@/lib/pnl";

export function Pill({ label, value }: { label: string; value: number }) {
  const positive = value >= 0;
  return (
    <div
      className={`inline-flex items-center gap-[5px] rounded-full px-[11px] py-[5px] text-[12.5px] font-semibold ${
        positive ? "bg-otto-green-soft text-otto-green" : "bg-otto-red-soft text-otto-red"
      }`}
    >
      {label}{" "}
      <span>
        {positive ? "+" : ""}
        {fmtMoney(value)}
      </span>
    </div>
  );
}
