"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { fmtDate, fmtMoney } from "@/lib/pnl";
import type { AssignmentDetail } from "@/lib/roi";

export function AssignmentCashCard({
  detail,
  className = "mb-3",
}: {
  detail: AssignmentDetail;
  className?: string;
}) {
  const { preferences } = useNotifications();
  const limit = preferences.assignmentCashThreshold;
  const usedPct = limit > 0 ? Math.round((detail.total / limit) * 100) : null;
  const overLimit = limit > 0 && detail.total > limit;

  if (detail.counted === 0) {
    return (
      <div className={`rounded-xl bg-otto-surface px-3.5 py-3 ${className}`}>
        <div className="text-[11px] text-otto-text-faint">Assignment cash backup</div>
        <div className="mt-1 text-[12.5px] text-otto-text-dim">
          No short puts open, so nothing can be assigned to you for cash right now.
        </div>
        <div className="mt-1 text-[10.5px] text-otto-text-faint">
          Put credit spreads, iron condors, cash-secured puts, and strangles count
          here at short strike × 100.
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl bg-otto-surface px-3.5 py-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] text-otto-text-faint">
            Assignment cash backup
          </div>
          <div className="mt-0.5 text-[10px] text-otto-text-faint">
            {detail.counted} short-put position{detail.counted === 1 ? "" : "s"} ·{" "}
            {detail.shares.toLocaleString()} shares if all are assigned
          </div>
        </div>
        <div
          className={`text-[17px] font-bold tabular-nums ${
            overLimit ? "text-otto-red" : ""
          }`}
        >
          {fmtMoney(detail.total)}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <AssignmentFact
          label="Next 14 days"
          value={detail.soonCount ? fmtMoney(detail.soonTotal) : "—"}
          hint={
            detail.soonCount
              ? `${detail.soonCount} expiring`
              : "Nothing expiring soon"
          }
        />
        <AssignmentFact
          label="Biggest name"
          value={detail.topTicker?.ticker ?? "—"}
          hint={
            detail.topTicker
              ? `${fmtMoney(detail.topTicker.amount)} · ${Math.round(
                  (detail.topTicker.amount / detail.total) * 100
                )}%`
              : ""
          }
        />
        <AssignmentFact
          label="Credit held"
          value={fmtMoney(detail.creditOpen)}
          hint="Premium on these legs"
        />
      </div>

      <div className="mt-2 text-[10.5px] leading-relaxed text-otto-text-faint">
        {detail.nearest && (
          <>
            Closest expiry {detail.nearest.ticker} {fmtDate(detail.nearest.expiry)}
            {detail.nearest.days <= 0
              ? " (today)"
              : ` (${detail.nearest.days} day${detail.nearest.days === 1 ? "" : "s"})`}
            .{" "}
          </>
        )}
        {limit > 0 ? (
          <span className={overLimit ? "text-otto-red" : undefined}>
            {usedPct}% of your {fmtMoney(limit)} limit.
          </span>
        ) : (
          <>Set a limit in Settings to get alerted when this climbs.</>
        )}
        {detail.excluded > 0 && (
          <>
            {" "}
            {detail.excluded} other open position
            {detail.excluded === 1 ? "" : "s"} cannot be assigned for cash.
          </>
        )}
      </div>
    </div>
  );
}

function AssignmentFact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-otto-bg px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-wider text-otto-text-faint">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[9.5px] text-otto-text-faint">{hint}</div>
    </div>
  );
}
