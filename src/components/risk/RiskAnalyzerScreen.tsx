"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import { usePositionEarnings } from "@/hooks/usePositionEarnings";
import { useTickerQuotes } from "@/hooks/useLiveQuotes";
import { useTrades } from "@/hooks/useTrades";
import { fmtMoney } from "@/lib/pnl";
import { analyzeTradeRisk, type RiskFactor } from "@/lib/riskAnalyzer";

export function RiskAnalyzerScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trades } = useTrades();
  const tradeId = searchParams.get("trade");
  const trade = trades.find((item) => item.id === tradeId);
  const earnings = usePositionEarnings(trade ? [trade] : []);
  const quotes = useTickerQuotes(trade ? [trade.ticker] : []);
  const report = useMemo(() => {
    if (!trade) return null;
    return analyzeTradeRisk(trade, {
      spot: quotes[trade.ticker]?.price,
      earningsDate: earnings[trade.ticker]?.earningsDate,
      sameTickerOpenTrades: trades.filter(
        (item) => item.status === "open" && item.ticker === trade.ticker
      ).length,
    });
  }, [earnings, quotes, trade, trades]);

  if (!trade || !report) {
    return (
      <section className="mx-auto max-w-[760px] rounded-2xl bg-otto-surface p-6 text-center">
        <ShieldCheck className="mx-auto text-otto-text-faint" />
        <h1 className="mt-3 text-xl font-extrabold">Trade not available</h1>
        <p className="mt-1 text-sm text-otto-text-faint">
          The saved trade could not be loaded for analysis.
        </p>
        <button
          type="button"
          onClick={() => router.push("/positions")}
          className="mt-5 rounded-full bg-otto-green px-5 py-2.5 text-sm font-bold text-black"
        >
          View positions
        </button>
      </section>
    );
  }

  const color =
    report.score >= 70
      ? "#ef4444"
      : report.score >= 45
        ? "#f97316"
        : report.score >= 20
          ? "#eab308"
          : "#50c83c";

  return (
    <section className="mx-auto w-full max-w-[860px] pb-10">
      <button
        type="button"
        onClick={() => router.push("/positions")}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-otto-text-dim"
      >
        <ArrowLeft size={15} /> Positions
      </button>

      <div className="overflow-hidden rounded-[28px] border border-otto-divider bg-otto-surface">
        <div className="relative px-5 py-6 desk:px-8 desk:py-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-otto-green/10 blur-3xl" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-otto-text-faint">
            New trade review
          </p>
          <div className="mt-2 flex flex-col gap-6 desk:flex-row desk:items-center desk:justify-between">
            <div>
              <h1 className="text-[28px] font-extrabold tracking-[-0.6px]">
                Risk Analyzer
              </h1>
              <p className="mt-1 text-sm font-semibold">
                {trade.ticker} · {trade.strategy}
              </p>
              <p className="mt-1 text-xs text-otto-text-faint">
                {strikeLabel(trade)} · {trade.contracts} contract
                {trade.contracts === 1 ? "" : "s"} · expires {trade.expiry}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="grid h-32 w-32 place-items-center rounded-full p-[9px]"
                style={{
                  background: `conic-gradient(${color} ${report.score * 3.6}deg, rgb(var(--otto-divider)) 0deg)`,
                }}
              >
                <div className="grid h-full w-full place-items-center rounded-full bg-otto-surface text-center">
                  <div>
                    <div className="text-[34px] font-black leading-none">{report.score}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
                      {report.level} risk
                    </div>
                  </div>
                </div>
              </div>
              <div className="max-w-44 text-[11px] leading-relaxed text-otto-text-faint">
                A 0–100 screening score based on currently known trade, event, and
                market factors. It is not a probability of loss.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-otto-divider">
          <Metric
            icon={CalendarClock}
            label="Days left"
            value={String(Math.max(0, report.daysToExpiry))}
          />
          <Metric
            icon={CircleDollarSign}
            label="Capital at risk"
            value={report.capitalAtRisk == null ? "Unknown" : fmtMoney(report.capitalAtRisk)}
          />
          <Metric
            icon={Gauge}
            label="Assignment"
            value={
              report.assignmentExposure == null
                ? "None"
                : fmtMoney(report.assignmentExposure)
            }
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-base font-extrabold">What is driving the score</h2>
            <p className="text-[11.5px] text-otto-text-faint">
              Review the highest-impact items before deciding how to manage the trade.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-otto-text-faint">
            {report.factors.filter((factor) => factor.points > 0).length} risks found
          </span>
        </div>
        <div className="space-y-2">
          {report.factors
            .slice()
            .sort((a, b) => b.points - a.points)
            .map((factor) => (
              <Factor key={factor.id} factor={factor} />
            ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-otto-divider px-4 py-3 text-[11px] leading-relaxed text-otto-text-faint">
        This is a deterministic pre-trade checklist, not investment advice. Scores can
        change as price, earnings dates, volatility, and time change.
      </div>
      <button
        type="button"
        onClick={() => router.push("/positions")}
        className="mt-5 w-full rounded-full bg-otto-green py-3 text-sm font-bold text-black"
      >
        Continue to positions
      </button>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="border-r border-otto-divider px-3 py-4 text-center last:border-r-0">
      <Icon size={15} className="mx-auto text-otto-text-faint" />
      <div className="mt-1.5 text-sm font-extrabold">{value}</div>
      <div className="mt-0.5 text-[9.5px] uppercase tracking-wide text-otto-text-faint">
        {label}
      </div>
    </div>
  );
}

function Factor({ factor }: { factor: RiskFactor }) {
  const safe = factor.level === "good";
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-otto-surface px-4 py-3.5">
      <div
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          safe ? "bg-otto-green-soft text-otto-green" : "bg-otto-amber-soft text-otto-amber"
        }`}
      >
        {safe ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold">{factor.label}</div>
          {factor.points > 0 && (
            <span className="shrink-0 rounded-full bg-otto-amber-soft px-2 py-0.5 text-[10px] font-bold text-otto-amber">
              +{factor.points}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-otto-text-faint">
          {factor.detail}
        </p>
      </div>
    </div>
  );
}

function strikeLabel(trade: {
  shortStrike: number | null;
  longStrike: number | null;
  callShortStrike: number | null;
  callLongStrike: number | null;
}) {
  const put = [trade.shortStrike, trade.longStrike].filter(
    (value): value is number => value != null
  );
  const call = [trade.callShortStrike, trade.callLongStrike].filter(
    (value): value is number => value != null
  );
  return [...put.map(String), ...call.map(String)].join("/") || "Strikes unavailable";
}
