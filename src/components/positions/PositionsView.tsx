"use client";

import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { Tabs } from "@/components/ui/Tabs";
import { TradeRow } from "@/components/positions/TradeRow";
import type { ClosePayload } from "@/types/trade";

type Filter = "open" | "closed" | "all";

export function PositionsView() {
  const { trades, closeTrade, deleteTrade, loading } = useTrades();
  const live = useLiveQuotes(trades);
  const optionMarks = useOptionMarks(trades);
  const [filter, setFilter] = useState<Filter>("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      trades
        .filter((t) => (filter === "all" ? true : t.status === filter))
        .sort((a, b) => (a.openDate < b.openDate ? 1 : -1)),
    [trades, filter]
  );

  async function onConfirmClose(id: string, payload: ClosePayload) {
    await closeTrade(id, payload);
    setClosingId(null);
    setExpanded(null);
  }

  async function onDelete(id: string) {
    await deleteTrade(id);
    setClosingId(null);
    setExpanded(null);
  }

  return (
    <div>
      <div className="mb-3.5">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      {!loading && visible.length === 0 && (
        <div className="px-1 py-10 text-center text-sm text-otto-text-faint">
          No trades here yet. Log one from the trade tab.
        </div>
      )}

      <div>
        {visible.map((t) => (
          <TradeRow
            key={t.id}
            t={t}
            open={expanded === t.id}
            onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
            closing={closingId === t.id}
            onStartClose={() => setClosingId(t.id)}
            onCancelClose={() => setClosingId(null)}
            onConfirmClose={(payload) => onConfirmClose(t.id, payload)}
            onDelete={() => void onDelete(t.id)}
            live={live[t.ticker]}
            optionMark={optionMarks[t.id]}
          />
        ))}
      </div>
    </div>
  );
}
