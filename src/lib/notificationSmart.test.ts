import { describe, expect, it } from "vitest";
import {
  combineSimilarAlerts,
  notificationGroupKey,
} from "@/lib/notificationSmart";
import type { SignalDraft } from "@/types/notification";

function milestone(id: string, threshold: number): SignalDraft {
  return {
    kind: "life_milestone",
    ticker: null,
    tradeId: null,
    groupId: null,
    title: `${id} milestone`,
    message: `${threshold} days`,
    severity: threshold <= 7 ? "warning" : "info",
    dedupeKey: `life_milestone:${id}:2026-12-01:${threshold}`,
  };
}

describe("milestone notification grouping", () => {
  it("combines milestones at the same threshold", () => {
    const [draft] = combineSimilarAlerts([milestone("a", 30), milestone("b", 30)]);
    expect(draft.title).toBe("2 Life milestones are approaching");
    expect(draft.dedupeKey).toContain(":30:");
  });

  it("keeps different fixed thresholds in separate groups", () => {
    const drafts = combineSimilarAlerts([milestone("a", 90), milestone("a", 30)]);
    expect(drafts).toHaveLength(2);
    expect(new Set(drafts.map(notificationGroupKey)).size).toBe(2);
  });
});
