"use client";

import type { ReactNode } from "react";
import { useScreenOption } from "@/hooks/useScreenOption";
import type { AiPortfolioReport } from "@/types/positionsAi";

type ReportLayout = "actions" | "board" | "detail";

const LAYOUTS: { value: ReportLayout; label: string }[] = [
  { value: "actions", label: "Action plan" },
  { value: "board", label: "Risk board" },
  { value: "detail", label: "Full detail" },
];

export function AiPortfolioReportViews({
  report,
}: {
  report: AiPortfolioReport;
}) {
  const [layout, setLayout] = useScreenOption("portfolioReportLayout");

  return (
    <div>
      <div className="mb-3">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
          Choose report style
        </div>
        <div className="grid grid-cols-3 rounded-xl bg-otto-surface p-1">
          {LAYOUTS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLayout(option.value)}
              className={`rounded-lg px-2 py-2 text-[11px] font-bold transition ${
                layout === option.value
                  ? "bg-otto-green text-black"
                  : "text-otto-text-dim"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {layout === "actions" && <ActionPlan report={report} />}
      {layout === "board" && <RiskBoard report={report} />}
      {layout === "detail" && <FullDetail report={report} />}
    </div>
  );
}

function ReportHeader({
  report,
  compact = false,
}: {
  report: AiPortfolioReport;
  compact?: boolean;
}) {
  return (
    <header
      className={
        compact
          ? "border-b border-otto-divider pb-3"
          : `rounded-2xl border p-3.5 ${
              report.bookRisk.level === "high"
                ? "border-otto-red/40 bg-otto-red-soft"
                : report.bookRisk.level === "medium"
                  ? "border-otto-amber/40 bg-otto-amber-soft"
                  : "border-otto-green/30 bg-otto-green-soft"
            }`
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-extrabold leading-snug">{report.headline}</div>
        <RiskPill level={report.bookRisk.level} />
      </div>
      <div className="mt-2 text-[11px] leading-relaxed text-otto-text-dim">
        {report.bookRisk.drivers.join(" · ") || "No book-level risk drivers returned."}
      </div>
      <div className="mt-2 text-[10px] text-otto-text-faint">
        Analysis as of {report.asOf}
      </div>
    </header>
  );
}

function ActionPlan({ report }: { report: AiPortfolioReport }) {
  return (
    <div className="space-y-4">
      <ReportHeader report={report} />

      <ActionSection title="What to do">
        {report.positions.length ? (
          report.positions.map((position) => (
            <div
              key={position.id}
              className="rounded-xl border border-otto-divider bg-otto-surface p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold">
                  {position.tkr} <span className="text-otto-text-faint">#{position.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RiskPill level={position.risk} />
                  <Badge>{position.action}</Badge>
                </div>
              </div>
              <div className="mt-2 text-xs leading-relaxed text-otto-text-dim">
                {position.why}
              </div>
              <Detail label="Act by" value={position.by} />
              <Detail label="Non-obvious risk" value={position.nonObvious} />
              <Detail label="Volume" value={position.volumeSignal} />
            </div>
          ))
        ) : (
          <Empty />
        )}
      </ActionSection>

      <ActionSection title="What could move the book">
        <CatalystItems items={report.catalysts} />
      </ActionSection>

      <ActionSection title="Crash and stress playbook">
        <ScenarioItems items={report.scenarios} />
      </ActionSection>

      <ActionSection title="Hidden concentration">
        <ConcentrationItems items={report.concentration} />
      </ActionSection>

      <ActionSection title="Pricing view">
        <MispricedItems items={report.mispriced} />
      </ActionSection>

      <ActionSection title="Blind spots">
        <StringItems items={report.blindSpots} />
      </ActionSection>

      <ActionSection title="Verify before acting">
        <VerifyItems items={report.verify} />
      </ActionSection>
    </div>
  );
}

function RiskBoard({ report }: { report: AiPortfolioReport }) {
  const urgent = report.positions.filter(
    (position) => position.risk === "high" || position.action === "close"
  ).length;

  return (
    <div className="space-y-3 rounded-2xl border border-otto-divider p-3.5">
      <ReportHeader report={report} compact />
      <div className="grid grid-cols-3 gap-2">
        <BoardStat label="Positions" value={String(report.positions.length)} />
        <BoardStat label="Urgent" value={String(urgent)} />
        <BoardStat label="Catalysts" value={String(report.catalysts.length)} />
      </div>
      <div className="grid gap-3 desk:grid-cols-2">
        <BoardCard title="Position map">
          <PositionRows items={report.positions} />
        </BoardCard>
        <BoardCard title="Catalyst calendar">
          <CatalystItems items={report.catalysts} />
        </BoardCard>
        <BoardCard title="Stress tests">
          <ScenarioItems items={report.scenarios} />
        </BoardCard>
        <BoardCard title="Shared exposure">
          <ConcentrationItems items={report.concentration} />
        </BoardCard>
        <BoardCard title="Pricing">
          <MispricedItems items={report.mispriced} />
        </BoardCard>
        <BoardCard title="Checks and blind spots">
          <StringItems items={report.blindSpots} />
          {report.blindSpots.length > 0 && report.verify.length > 0 && (
            <div className="my-2 border-t border-otto-divider" />
          )}
          <VerifyItems items={report.verify} />
        </BoardCard>
      </div>
    </div>
  );
}

function FullDetail({ report }: { report: AiPortfolioReport }) {
  return (
    <article className="rounded-2xl border border-otto-divider bg-otto-surface/40 p-4">
      <ReportHeader report={report} compact />
      <DocumentSection title="1. Position decisions">
        <PositionRows items={report.positions} expanded />
      </DocumentSection>
      <DocumentSection title="2. Catalysts">
        <CatalystItems items={report.catalysts} />
      </DocumentSection>
      <DocumentSection title="3. Concentration">
        <ConcentrationItems items={report.concentration} />
      </DocumentSection>
      <DocumentSection title="4. Pricing assessment">
        <MispricedItems items={report.mispriced} />
      </DocumentSection>
      <DocumentSection title="5. Stress scenarios">
        <ScenarioItems items={report.scenarios} />
      </DocumentSection>
      <DocumentSection title="6. Blind spots">
        <StringItems items={report.blindSpots} />
      </DocumentSection>
      <DocumentSection title="7. Claims to verify">
        <VerifyItems items={report.verify} />
      </DocumentSection>
    </article>
  );
}

function PositionRows({
  items,
  expanded = false,
}: {
  items: AiPortfolioReport["positions"];
  expanded?: boolean;
}) {
  if (!items.length) return <Empty />;
  return (
    <div className="divide-y divide-otto-divider">
      {items.map((position) => (
        <div key={position.id} className="py-2 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span>
              {position.tkr} #{position.id}
            </span>
            <Badge>{position.action}</Badge>
            <RiskPill level={position.risk} />
          </div>
          <div className="mt-1 text-xs leading-relaxed text-otto-text-dim">
            {position.why}
          </div>
          <Detail label="Act by" value={position.by} />
          <Detail label="Non-obvious risk" value={position.nonObvious} />
          {(expanded || position.volumeSignal) && (
            <Detail label="Volume" value={position.volumeSignal} />
          )}
        </div>
      ))}
    </div>
  );
}

function CatalystItems({ items }: { items: AiPortfolioReport["catalysts"] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.date}-${item.event}-${index}`} className="text-xs leading-relaxed">
          <div className="flex flex-wrap items-center gap-1.5 font-bold">
            <span>{item.date}</span>
            <Badge>{item.impact} impact</Badge>
            <span>{item.scope}</span>
          </div>
          <div className="mt-0.5">{item.event}</div>
          <div className="text-otto-text-dim">{item.note}</div>
          <div className="text-[10.5px] text-otto-text-faint">
            Affects {ids(item.affects)}
            {item.sourceUrl && (
              <>
                {" · "}
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-otto-green underline"
                >
                  source
                </a>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenarioItems({ items }: { items: AiPortfolioReport["scenarios"] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`} className="text-xs leading-relaxed">
          <div className="font-bold">{item.name}</div>
          <Detail label="Trigger" value={item.trigger} />
          <Detail label="Book impact" value={item.bookImpact} />
          <Detail label="First to break" value={item.firstToBreak} />
        </div>
      ))}
    </div>
  );
}

function ConcentrationItems({
  items,
}: {
  items: AiPortfolioReport["concentration"];
}) {
  if (!items.length) return <Empty />;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.factor}-${index}`} className="text-xs leading-relaxed">
          <div className="font-bold">
            {item.factor} <span className="font-normal text-otto-text-faint">· {ids(item.ids)}</span>
          </div>
          <div className="text-otto-text-dim">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

function MispricedItems({ items }: { items: AiPortfolioReport["mispriced"] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.id}-${index}`} className="text-xs leading-relaxed">
          <span className="font-bold">#{item.id}</span>{" "}
          <Badge>{item.view}</Badge>{" "}
          <span className="text-otto-text-dim">{item.note}</span>
        </div>
      ))}
    </div>
  );
}

function VerifyItems({ items }: { items: AiPortfolioReport["verify"] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.claim}-${index}`} className="text-xs leading-relaxed">
          <div className="font-bold">{item.claim}</div>
          <div className="text-otto-text-dim">{item.why}</div>
        </div>
      ))}
    </div>
  );
}

function StringItems({ items }: { items: string[] }) {
  if (!items.length) return <Empty />;
  return (
    <ul className="space-y-1.5 text-xs leading-relaxed text-otto-text-dim">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="text-otto-amber">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function BoardCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-otto-surface p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
        {title}
      </div>
      {children}
    </section>
  );
}

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-otto-divider py-4 last:border-b-0 last:pb-0">
      <h4 className="mb-2 text-xs font-extrabold">{title}</h4>
      {children}
    </section>
  );
}

function BoardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-otto-surface p-2.5 text-center">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[10px] text-otto-text-faint">{label}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 text-[11px] leading-relaxed">
      <span className="font-semibold text-otto-text">{label}:</span>{" "}
      <span className="text-otto-text-dim">{value || "Not provided"}</span>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-otto-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-otto-text-dim">
      {children}
    </span>
  );
}

function RiskPill({ level }: { level: "low" | "medium" | "high" }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
        level === "high"
          ? "bg-otto-red-soft text-otto-red"
          : level === "medium"
            ? "bg-otto-amber-soft text-otto-amber"
            : "bg-otto-green-soft text-otto-green"
      }`}
    >
      {level}
    </span>
  );
}

function Empty() {
  return <div className="text-xs text-otto-text-faint">None returned.</div>;
}

function ids(values: number[]) {
  return values.length ? values.map((value) => `#${value}`).join(", ") : "none";
}
