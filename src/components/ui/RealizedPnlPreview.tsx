"use client";

import { fmtMoney, realizedPnl } from "@/lib/pnl";

export function RealizedPnlPreview({
  premiumOpen,
  premiumClose,
  contracts,
}: {
  premiumOpen: string | number;
  premiumClose: string;
  contracts: string | number;
}) {
  if (premiumClose.trim() === "") return null;
  const close = Number(premiumClose);
  const open = Number(premiumOpen);
  const count = Number(contracts);
  if (!Number.isFinite(close) || !Number.isFinite(open) || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const pnl = realizedPnl(open, close, count);
  const positive = pnl >= 0;
  return (
    <div
      className={`rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${
        positive
          ? "bg-otto-green-soft text-otto-green"
          : "bg-otto-red-soft text-otto-red"
      }`}
    >
      Realized P/L {positive ? "+" : ""}
      {fmtMoney(pnl)}
      <span className="ml-1.5 font-medium opacity-80">Preview — not saved yet</span>
    </div>
  );
}
