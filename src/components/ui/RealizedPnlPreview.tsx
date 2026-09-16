"use client";

import { fmtMoney, realizedPnl } from "@/lib/pnl";

export function RealizedPnlPreview({
  premiumOpen,
  premiumClose,
  contracts,
  strategy,
  commissionOpen = 0,
  commissionClose = 0,
}: {
  premiumOpen: string | number;
  premiumClose: string;
  contracts: string | number;
  strategy: string;
  commissionOpen?: string | number;
  commissionClose?: string | number;
}) {
  if (premiumClose.trim() === "") return null;
  const close = Number(premiumClose);
  const open = Number(premiumOpen);
  const count = Number(contracts);
  if (!Number.isFinite(close) || !Number.isFinite(open) || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const fees = Number(commissionOpen) + Number(commissionClose);
  const gross = realizedPnl(open, close, count, strategy);
  const pnl = realizedPnl(open, close, count, strategy, {
    commissionOpen: Number(commissionOpen) || 0,
    commissionClose: Number(commissionClose) || 0,
  });
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
      {fees > 0 && (
        <span className="ml-1.5 font-medium opacity-80">
          gross {fmtMoney(gross)} − fees {fmtMoney(fees)}
        </span>
      )}
      <span className="ml-1.5 font-medium opacity-80">Preview — not saved yet</span>
    </div>
  );
}
