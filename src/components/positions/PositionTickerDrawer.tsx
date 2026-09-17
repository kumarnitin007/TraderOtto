"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import type { OptionMark } from "@/hooks/useOptionMarks";
import { TickerResearch } from "@/components/ticker/TickerResearch";
import { fmtDate, fmtMoney, markPnl, tradePnl } from "@/lib/pnl";
import type { TickerDetails } from "@/types/tickerDetails";
import { isDebitStrategy, type Trade } from "@/types/trade";

export function PositionTickerDrawer({
  trade,
  optionMark,
  onClose,
}: {
  trade: Trade;
  optionMark?: OptionMark;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<TickerDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/ticker/${encodeURIComponent(trade.ticker)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => !cancelled && setDetails(data as TickerDetails | null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [trade.ticker]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const openingValue = Math.abs(trade.premiumOpen) * trade.contracts * 100;
  const unrealized =
    optionMark?.mark == null ? null : markPnl(trade, optionMark.mark);
  const pnl = trade.status === "closed" ? tradePnl(trade) : unrealized;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close position details"
        onClick={onClose}
        className="absolute inset-0 bg-black/65"
      />
      <aside className="otto-drawer absolute bottom-0 right-0 top-0 w-full max-w-[460px] overflow-y-auto border-l border-otto-divider bg-otto-bg px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] shadow-2xl desk:px-5">
        <div className="sticky top-0 z-10 flex items-start justify-between bg-otto-bg pb-3">
          <div>
            <div className="text-xs font-semibold text-otto-text-faint">Position</div>
            <h2 className="mt-0.5 text-2xl font-extrabold">{trade.ticker}</h2>
            <div className="mt-0.5 text-xs text-otto-text-dim">{trade.strategy}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface text-otto-text-dim"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <section className="mt-2 rounded-2xl bg-otto-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
                Stock
              </div>
              <div className="mt-1 text-[30px] font-extrabold">
                {details?.price != null ? `$${details.price.toFixed(2)}` : "—"}
              </div>
            </div>
            {details?.change != null && details.changePct != null && (
              <div
                className={`pb-1 text-right text-sm font-bold ${
                  details.change >= 0 ? "text-otto-green" : "text-otto-red"
                }`}
              >
                {details.change >= 0 ? "+" : ""}
                {fmtMoney(details.change)}
                <div className="text-xs">{details.changePct.toFixed(2)}%</div>
              </div>
            )}
          </div>
          {loading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-otto-text-faint">
              <LoaderCircle size={13} className="otto-spin" /> Loading Alpaca data…
            </div>
          )}
          {!loading && details?.marketSource === "unavailable" && (
            <div className="mt-2 text-xs text-otto-red">
              Alpaca offline — real-time data unavailable.
            </div>
          )}
          {details?.market && (
            <div className="mt-2 text-xs text-otto-text-dim">
              Market {details.market.isOpen ? "open" : "closed"} ·{" "}
              {details.market.isOpen ? "closes" : "opens"}{" "}
              {formatDateTime(
                details.market.isOpen
                  ? details.market.nextClose
                  : details.market.nextOpen
              )}
            </div>
          )}
        </section>

        <section className="mt-5">
          <SectionTitle>Option position</SectionTitle>
          <div className="mt-2 rounded-2xl bg-otto-surface p-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Opened" value={`$${Math.abs(trade.premiumOpen).toFixed(2)}`} />
              <Metric
                label="Live mark"
                value={optionMark ? `$${optionMark.mark.toFixed(2)}` : "—"}
              />
              <Metric
                label={trade.status === "closed" ? "Final P/L" : "Open P/L"}
                value={
                  pnl == null
                    ? "—"
                    : `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`
                }
                accent={pnl == null ? undefined : pnl >= 0 ? "green" : "red"}
              />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-otto-divider pt-3">
              <Metric label="IV" value={percent(optionMark?.iv)} />
              <Metric label="Delta" value={decimal(optionMark?.delta)} />
              <Metric label="Theta" value={decimal(optionMark?.theta)} />
              <Metric label="Vega" value={decimal(optionMark?.vega)} />
            </div>
            <div className="mt-3 text-[10.5px] text-otto-text-faint">
              {optionMark
                ? "Actual option-leg midpoints and Greeks from Alpaca."
                : trade.status === "open"
                  ? "Alpaca option quote unavailable."
                  : `Opening ${isDebitStrategy(trade.strategy) ? "debit" : "credit"} ${fmtMoney(Math.abs(openingValue))}.`}
            </div>
          </div>
        </section>

        <section className="mt-5">
          <SectionTitle>Day range</SectionTitle>
          <div className="mt-2 grid grid-cols-4 gap-2 rounded-2xl bg-otto-surface p-3.5">
            <Metric label="Open" value={money(details?.open)} />
            <Metric label="Low" value={money(details?.low)} />
            <Metric label="High" value={money(details?.high)} />
            <Metric label="Prev" value={money(details?.previousClose)} />
          </div>
        </section>

        <section className="mt-5">
          <SectionTitle>Earnings</SectionTitle>
          <div className="mt-2 rounded-2xl bg-otto-surface p-3.5 text-sm">
            {details?.earnings ? (
              <>
                <div className="font-bold">{fmtDate(details.earnings.date)}</div>
                <div className="mt-1 text-xs text-otto-text-dim">
                  {details.earnings.timing}
                  {details.earnings.epsForecast
                    ? ` · EPS est. ${details.earnings.epsForecast}`
                    : ""}
                </div>
              </>
            ) : (
              <div className="text-otto-text-faint">No earnings in the next 3 months.</div>
            )}
          </div>
        </section>

        <TickerResearch
          details={details}
          levels={[
            trade.longStrike
              ? { label: "Long", price: trade.longStrike }
              : null,
            trade.shortStrike
              ? { label: "Short", price: trade.shortStrike }
              : null,
            trade.callShortStrike
              ? { label: "Call short", price: trade.callShortStrike }
              : null,
            trade.callLongStrike
              ? { label: "Call long", price: trade.callLongStrike }
              : null,
          ].filter((level): level is { label: string; price: number } =>
            Boolean(level && level.price > 0)
          )}
        />
      </aside>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold uppercase tracking-wider text-otto-text-faint">
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] text-otto-text-faint">{label}</div>
      <div
        className={`mt-1 truncate text-xs font-bold ${
          accent === "green"
            ? "text-otto-green"
            : accent === "red"
              ? "text-otto-red"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function money(value?: number | null) {
  return typeof value === "number" ? `$${value.toFixed(2)}` : "—";
}

function decimal(value?: number) {
  return typeof value === "number" ? value.toFixed(3) : "—";
}

function percent(value?: number) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
