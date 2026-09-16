import type { AiPerformanceReport } from "@/types/performanceAi";

export function performanceReportDelta(
  previous: AiPerformanceReport,
  next: AiPerformanceReport
) {
  const changes: string[] = [];
  if (previous.headline !== next.headline) {
    changes.push(`New conclusion: ${next.headline}`);
  }

  const beforeIdeas = new Set(
    previous.tradeIdeas.map((idea) => idea.ticker.toUpperCase())
  );
  const afterIdeas = new Set(
    next.tradeIdeas.map((idea) => idea.ticker.toUpperCase())
  );
  const added = [...afterIdeas].filter((ticker) => !beforeIdeas.has(ticker));
  const removed = [...beforeIdeas].filter((ticker) => !afterIdeas.has(ticker));
  if (added.length) changes.push(`New trade candidates: ${added.join(", ")}`);
  if (removed.length) changes.push(`Candidates removed: ${removed.join(", ")}`);

  const beforeRules = new Set(
    previous.improvements.map((item) => item.change.toLowerCase())
  );
  const addedRules = next.improvements.filter(
    (item) => !beforeRules.has(item.change.toLowerCase())
  );
  if (addedRules.length) {
    changes.push(
      `New process priority: ${addedRules
        .sort((a, b) => a.priority - b.priority)[0].change}`
    );
  }

  if (next.period.tradeCount !== previous.period.tradeCount) {
    changes.push(
      `Sample changed from ${previous.period.tradeCount} to ${next.period.tradeCount} trades.`
    );
  }
  return changes.slice(0, 5);
}
