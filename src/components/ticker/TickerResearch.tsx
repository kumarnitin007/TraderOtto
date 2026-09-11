"use client";

import { ExternalLink } from "lucide-react";
import { fmtDate } from "@/lib/pnl";
import type { TickerDetails } from "@/types/tickerDetails";

export function TickerResearch({ details }: { details: TickerDetails | null }) {
  if (!details) return null;

  return (
    <>
      {details.company && (
        <section className="mt-6">
          <Title>Company</Title>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-otto-surface p-3.5">
            {details.company.logo ? (
              // Finnhub provides the company logo URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={details.company.logo}
                alt=""
                className="h-10 w-10 rounded-lg bg-white object-contain p-1"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{details.company.name}</div>
              <div className="mt-0.5 truncate text-xs text-otto-text-faint">
                {[details.company.industry, details.company.exchange]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {details.company.website && (
              <a
                href={details.company.website}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${details.company.name} website`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-otto-surface-raise text-otto-text-dim"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </section>
      )}

      {details.fundamentals && (
        <section className="mt-6">
          <Title>Fundamentals</Title>
          <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-otto-divider">
            <Stat label="Market cap" value={compactMoney(details.fundamentals.marketCap, true)} />
            <Stat label="P/E" value={decimal(details.fundamentals.pe, 1)} />
            <Stat label="Beta" value={decimal(details.fundamentals.beta, 2)} />
            <Stat label="52w high" value={money(details.fundamentals.high52)} />
            <Stat label="52w low" value={money(details.fundamentals.low52)} />
            <Stat label="Dividend" value={percent(details.fundamentals.dividendYield)} />
            <Stat label="Revenue YoY" value={percent(details.fundamentals.revenueGrowth)} />
            <Stat label="EPS YoY" value={percent(details.fundamentals.epsGrowth)} />
          </div>
        </section>
      )}

      {details.analyst && (
        <section className="mt-6">
          <Title>Analyst view</Title>
          <div className="mt-2 rounded-2xl bg-otto-surface p-3.5">
            <div className="grid grid-cols-5 gap-1 text-center">
              <Rating label="Strong buy" value={details.analyst.strongBuy} tone="green" />
              <Rating label="Buy" value={details.analyst.buy} tone="green" />
              <Rating label="Hold" value={details.analyst.hold} />
              <Rating label="Sell" value={details.analyst.sell} tone="red" />
              <Rating label="Strong sell" value={details.analyst.strongSell} tone="red" />
            </div>
            {details.analyst.targetMean != null && (
              <div className="mt-3 border-t border-otto-divider pt-3 text-xs text-otto-text-dim">
                Mean target <strong className="text-otto-text">{money(details.analyst.targetMean)}</strong>
                {details.analyst.targetLow != null && details.analyst.targetHigh != null
                  ? ` · ${money(details.analyst.targetLow)}–${money(details.analyst.targetHigh)}`
                  : ""}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <Title>Corporate actions</Title>
        <div className="mt-2 rounded-2xl bg-otto-surface p-3.5">
          {details.corporateActions.length ? (
            details.corporateActions.map((action, index) => (
              <div
                key={`${action.type}-${action.date}-${index}`}
                className="border-b border-otto-divider py-2 first:pt-0 last:border-0 last:pb-0"
              >
                <div className="text-sm font-semibold">{action.label}</div>
                {action.date && (
                  <div className="mt-0.5 text-xs text-otto-text-faint">
                    {fmtDate(action.date)}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-otto-text-faint">
              No recent or upcoming actions.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <Title>Recent news</Title>
          <div className="text-[10px] text-otto-text-faint">Alpaca + Finnhub</div>
        </div>
        <div className="mt-2 overflow-hidden rounded-2xl bg-otto-surface px-3.5">
          {details.news.length ? (
            details.news.map((article) => (
              <a
                key={article.id}
                href={article.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block border-b border-otto-divider py-3 last:border-0"
              >
                <div className="flex gap-2 text-sm font-semibold leading-snug">
                  <span className="flex-1">{article.headline}</span>
                  {article.url && (
                    <ExternalLink
                      size={13}
                      className="mt-0.5 shrink-0 text-otto-text-faint"
                    />
                  )}
                </div>
                {article.summary && (
                  <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-otto-text-dim">
                    {article.summary}
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-otto-text-faint">
                  <span className="rounded-full bg-otto-surface-raise px-1.5 py-0.5 capitalize">
                    {article.provider}
                  </span>
                  <span>{article.source}</span>
                  {article.createdAt && <span>· {formatDateTime(article.createdAt)}</span>}
                </div>
              </a>
            ))
          ) : (
            <div className="py-3.5 text-sm text-otto-text-faint">
              No recent company news found.
            </div>
          )}
        </div>
        {!details.providers.finnhubConfigured && (
          <div className="mt-2 rounded-xl border border-otto-divider px-3 py-2 text-[11px] text-otto-text-faint">
            Add a Finnhub API key to enable company fundamentals and analyst data.
          </div>
        )}
      </section>
    </>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold uppercase tracking-wider text-otto-text-faint">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-otto-surface px-3 py-2.5">
      <div className="truncate text-[9.5px] text-otto-text-faint">{label}</div>
      <div className="mt-1 truncate text-xs font-bold">{value}</div>
    </div>
  );
}

function Rating({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red";
}) {
  return (
    <div>
      <div
        className={`text-sm font-extrabold ${
          tone === "green"
            ? "text-otto-green"
            : tone === "red"
              ? "text-otto-red"
              : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-[8.5px] text-otto-text-faint">{label}</div>
    </div>
  );
}

function money(value: number | null) {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function compactMoney(value: number | null, millions = false) {
  if (value == null) return "—";
  const amount = millions ? value * 1_000_000 : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function decimal(value: number | null, places: number) {
  return value == null ? "—" : value.toFixed(places);
}

function percent(value: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
