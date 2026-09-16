"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/pnl";
import {
  AI_TRADE_DRAFT_KEY,
  tradeDraftFromIdea,
} from "@/lib/aiTradeDraft";
import type { AiPerformanceReport } from "@/types/performanceAi";

export function AiPerformanceReportView({
  report,
}: {
  report: AiPerformanceReport;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4 rounded-2xl border border-otto-divider p-3.5">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-extrabold leading-snug">
            {report.headline}
          </div>
          <span className="shrink-0 rounded-full bg-otto-green-soft px-2 py-1 text-[9px] font-bold uppercase text-otto-green">
            {report.mode.replace("_", " ")}
          </span>
        </div>
        <div className="mt-1 text-xs leading-relaxed text-otto-text-dim">
          {report.verdict}
        </div>
        <div className="mt-2 text-[10px] text-otto-text-faint">
          {report.period.label} · {report.period.tradeCount} closed trades · as
          of {report.asOf}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 desk:grid-cols-4">
        <Score
          label="Realized"
          value={fmtMoney(report.scorecard.realizedPnl)}
        />
        <Score
          label="Win rate"
          value={`${number(report.scorecard.winRate)}%`}
        />
        <Score
          label="Avg ROI"
          value={`${signed(report.scorecard.avgRoi)}%`}
        />
        <Score
          label="Avg hold"
          value={`${number(report.scorecard.avgHoldDays)}d`}
        />
      </div>

      <div className="rounded-xl bg-otto-surface p-3 text-xs">
        <Labeled label="Best dimension" value={report.scorecard.bestDimension} />
        <Labeled label="Weakest dimension" value={report.scorecard.worstDimension} />
      </div>

      <Section title="Evidence from your journal">
        {report.findings.length ? (
          report.findings.map((finding, index) => (
            <div
              key={`${finding.title}-${index}`}
              className="rounded-xl bg-otto-surface p-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold">{finding.title}</div>
                <Significance value={finding.significance} />
              </div>
              <div className="mt-1 leading-relaxed text-otto-text-dim">
                {finding.evidence}
              </div>
              <div className="mt-1 text-[10px] text-otto-text-faint">
                Trades{" "}
                {finding.tradeIds.length
                  ? finding.tradeIds.map((id) => `#${id}`).join(", ")
                  : "not specified"}
              </div>
            </div>
          ))
        ) : (
          <Empty />
        )}
      </Section>

      {report.tradeIdeas.length > 0 && (
        <Section title="Trade setups to research">
          {report.tradeIdeas.map((idea, index) => (
            <div
              key={`${idea.ticker}-${index}`}
              className="rounded-xl border border-otto-divider bg-otto-surface p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold">{idea.ticker}</span>
                <Pill>{idea.bias}</Pill>
                <Pill>{idea.strategy}</Pill>
              </div>
              <div className="mt-2 leading-relaxed">{idea.setup}</div>
              <Labeled label="Wait for" value={idea.entryTrigger} />
              <Labeled label="Invalid if" value={idea.invalidation} />
              <Labeled label="Why it fits you" value={idea.whyFitsStyle} />
              <Labeled label="Main risk" value={idea.risk} />
              {idea.sourceUrl && (
                <a
                  href={idea.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-otto-green"
                >
                  Research source <ExternalLink size={11} />
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  window.sessionStorage.setItem(
                    AI_TRADE_DRAFT_KEY,
                    JSON.stringify(tradeDraftFromIdea(idea, report))
                  );
                  router.push("/log?draft=ai");
                }}
                className="mt-3 w-full rounded-full border border-otto-green py-2 text-xs font-bold text-otto-green"
              >
                Prefill a trade draft
              </button>
            </div>
          ))}
        </Section>
      )}

      <Section title="What to change">
        {report.improvements.length ? (
          [...report.improvements]
            .sort((a, b) => a.priority - b.priority)
            .map((item, index) => (
              <div key={`${item.priority}-${index}`} className="text-xs">
                <div className="font-bold">
                  {item.priority}. {item.change}
                </div>
                <Labeled label="Evidence" value={item.evidence} />
                <Labeled label="Rule" value={item.implementation} />
                <Labeled label="Measure" value={item.measure} />
              </div>
            ))
        ) : (
          <Empty />
        )}
      </Section>

      <div className="grid gap-3 desk:grid-cols-2">
        <ListSection title="Strengths to preserve" items={report.strengths} />
        <ListSection title="Cautions" items={report.cautions} warning />
      </div>

      {report.verify.length > 0 && (
        <Section title="Verify before acting">
          {report.verify.map((item, index) => (
            <div key={`${item.claim}-${index}`} className="text-xs">
              <div className="font-bold">{item.claim}</div>
              <div className="mt-0.5 text-otto-text-dim">{item.why}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-otto-surface p-2.5">
      <div className="text-[10px] text-otto-text-faint">{label}</div>
      <div className="mt-1 text-sm font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ListSection({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  return (
    <section className="rounded-xl bg-otto-surface p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        {title}
      </h4>
      {items.length ? (
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-otto-text-dim">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className={warning ? "text-otto-amber" : "text-otto-green"}>
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2">
          <Empty />
        </div>
      )}
    </section>
  );
}

function Labeled({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 text-[11px] leading-relaxed">
      <span className="font-semibold text-otto-text">{label}:</span>{" "}
      <span className="text-otto-text-dim">{value || "Not provided"}</span>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-otto-bg px-2 py-0.5 text-[9px] font-bold uppercase text-otto-text-dim">
      {children}
    </span>
  );
}

function Significance({
  value,
}: {
  value: "low" | "medium" | "high";
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
        value === "high"
          ? "bg-otto-red-soft text-otto-red"
          : value === "medium"
            ? "bg-otto-amber-soft text-otto-amber"
            : "bg-otto-green-soft text-otto-green"
      }`}
    >
      {value}
    </span>
  );
}

function Empty() {
  return <div className="text-xs text-otto-text-faint">None returned.</div>;
}

function number(value: number) {
  return Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "—";
}

function signed(value: number) {
  const formatted = number(value);
  return value > 0 && formatted !== "—" ? `+${formatted}` : formatted;
}
