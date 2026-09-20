import type {
  NotificationSignal,
  SignalDraft,
} from "@/types/notification";

const SEVERITY_RANK: Record<SignalDraft["severity"], number> = {
  info: 0,
  success: 1,
  warning: 2,
  critical: 3,
};

export function firedWithinCooldown(
  signals: NotificationSignal[],
  dedupeKey: string,
  cooldownHours: number,
  now = new Date()
) {
  const cutoff = now.getTime() - Math.max(1, cooldownHours) * 3_600_000;
  return signals.some(
    (signal) =>
      signal.dedupeKey === dedupeKey &&
      new Date(signal.firedAt).getTime() >= cutoff
  );
}

export function groupFiredWithinCooldown(
  signals: NotificationSignal[],
  draft: SignalDraft,
  cooldownHours: number,
  now = new Date()
) {
  const cutoff = now.getTime() - Math.max(1, cooldownHours) * 3_600_000;
  const group = notificationGroupKey(draft);
  return signals.some(
    (signal) =>
      notificationGroupKey(signal) === group &&
      new Date(signal.firedAt).getTime() >= cutoff
  );
}

export function notificationGroupKey(
  item: Pick<
    NotificationSignal,
    "kind" | "ticker" | "groupId" | "severity" | "dedupeKey"
  >
) {
  const direction =
    item.kind === "price_range"
      ? /:below(?::|$)/.test(item.dedupeKey)
        ? "below"
        : /:above(?::|$)/.test(item.dedupeKey)
          ? "above"
          : "range"
      : "";
  return [
    item.kind,
    item.ticker ?? item.groupId ?? "book",
    direction,
    item.severity,
  ].join(":");
}

function combinedTitle(first: SignalDraft, count: number) {
  const ticker = first.ticker;
  if (count === 1 || !ticker) return first.title;
  if (first.kind === "position_risk") {
    return `${count} ${ticker} positions need attention`;
  }
  if (first.kind === "near_max") {
    return `${count} ${ticker} positions are near max profit`;
  }
  if (first.kind === "expiry_soon") {
    return `${count} ${ticker} positions expire soon`;
  }
  if (first.kind === "price_range") {
    return `${ticker} crossed ${count} watch-list ranges`;
  }
  if (first.kind === "earnings_soon") {
    return `${ticker} earnings is tracked in ${count} lists`;
  }
  return `${count} similar alerts · ${first.title}`;
}

/**
 * Combines simultaneous alerts that describe the same ticker and condition.
 * Severity remains part of the key so a critical escalation is not swallowed
 * by an earlier warning.
 */
export function combineSimilarAlerts(drafts: SignalDraft[]) {
  const groups = new Map<string, SignalDraft[]>();
  for (const draft of drafts) {
    const key = notificationGroupKey(draft);
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }
  return Array.from(groups, ([key, matching]) => {
    const ordered = matching.slice().sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    );
    const first = ordered[0];
    const messages = [...new Set(ordered.map((draft) => draft.message))];
    return {
      ...first,
      tradeId: matching.length === 1 ? first.tradeId : null,
      groupId: matching.length === 1 ? first.groupId : null,
      title: combinedTitle(first, matching.length),
      message:
        matching.length === 1
          ? first.message
          : messages.slice(0, 3).join(" · ") +
            (messages.length > 3 ? ` · +${messages.length - 3} more` : ""),
      dedupeKey: `smart:${key}`,
    } satisfies SignalDraft;
  });
}
