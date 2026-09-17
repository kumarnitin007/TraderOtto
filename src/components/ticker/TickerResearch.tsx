"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { fmtDate } from "@/lib/pnl";
import type { TickerDetails } from "@/types/tickerDetails";
import { TickerPriceChart, type ChartLevel } from "@/components/ticker/TickerPriceChart";

export function TickerResearch({
  details,
  levels,
}: {
  details: TickerDetails | null;
  levels?: ChartLevel[];
}) {
  if (!details) return null;

  const news = details.news;
  const actions = details.corporateActions;

  return (
    <>
      <TickerPriceChart chart={details.chart} levels={levels} />
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
        <CollapsibleSection
          title="Fundamentals"
          preview={`${compactMoney(details.fundamentals.marketCap, true)} mkt · P/E ${decimal(details.fundamentals.pe, 1)}`}
        >
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-otto-divider">
            <Stat label="Market cap" value={compactMoney(details.fundamentals.marketCap, true)} />
            <Stat label="P/E" value={decimal(details.fundamentals.pe, 1)} />
            <Stat label="Beta" value={decimal(details.fundamentals.beta, 2)} />
            <Stat label="52w high" value={money(details.fundamentals.high52)} />
            <Stat label="52w low" value={money(details.fundamentals.low52)} />
            <Stat label="Dividend" value={percent(details.fundamentals.dividendYield)} />
            <Stat label="Revenue YoY" value={percent(details.fundamentals.revenueGrowth)} />
            <Stat label="EPS YoY" value={percent(details.fundamentals.epsGrowth)} />
          </div>
        </CollapsibleSection>
      )}

      {details.analyst && (
        <CollapsibleSection
          title="Analyst view"
          preview={
            details.analyst.targetMean != null
              ? `Mean ${money(details.analyst.targetMean)} · ${details.analyst.buy + details.analyst.strongBuy} buys`
              : `${details.analyst.buy + details.analyst.strongBuy} buys · ${details.analyst.hold} holds`
          }
        >
          <div className="rounded-2xl bg-otto-surface p-3.5">
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
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Corporate actions"
        preview={
          actions[0]
            ? `${actions[0].label}${actions.length > 1 ? ` · +${actions.length - 1}` : ""}`
            : "None upcoming"
        }
      >
        <div className="rounded-2xl bg-otto-surface p-3.5">
          {actions.length ? (
            actions.map((action, index) => (
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
      </CollapsibleSection>

      <NewsSection news={news} />

      {!details.providers.finnhubConfigured && (
        <div className="mt-4 rounded-xl border border-otto-divider px-3 py-2 text-[11px] text-otto-text-faint">
          Add a Finnhub API key to enable company fundamentals and analyst data.
        </div>
      )}
    </>
  );
}

function NewsSection({ news }: { news: TickerDetails["news"] }) {
  const [open, setOpen] = useState(false);
  const visible = open ? news : news.slice(0, 1);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <Title>Recent news</Title>
        <div className="text-[10px] text-otto-text-faint">Alpaca + Finnhub</div>
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl bg-otto-surface px-3.5">
        {news.length ? (
          visible.map((article) => (
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
                <div
                  className={`mt-1 text-xs leading-relaxed text-otto-text-dim ${
                    open ? "" : "line-clamp-2"
                  }`}
                >
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
      {news.length > 1 && (
        <Toggle
          open={open}
          onClick={() => setOpen((value) => !value)}
          moreLabel={`Show ${news.length - 1} more`}
        />
      )}
    </section>
  );
}

function CollapsibleSection({
  title,
  preview,
  children,
}: {
  title: string;
  preview: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 bg-transparent text-left"
      >
        <div className="min-w-0">
          <Title>{title}</Title>
          {!open && (
            <div className="mt-1 truncate text-xs text-otto-text-dim">{preview}</div>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-otto-text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}

function Toggle({
  open,
  onClick,
  moreLabel,
}: {
  open: boolean;
  onClick: () => void;
  moreLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center justify-center gap-1 bg-transparent text-[12px] font-semibold text-otto-text-dim"
    >
      {open ? "Show less" : moreLabel}
      <ChevronDown size={14} className={open ? "rotate-180" : ""} />
    </button>
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
