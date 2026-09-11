"use client";

import { useEffect, useMemo, useState } from "react";
import { useScreenOption } from "@/hooks/useScreenOption";
import { ChevronDown } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { Tabs } from "@/components/ui/Tabs";
import { TradeRow } from "@/components/positions/TradeRow";
import { PositionTickerDrawer } from "@/components/positions/PositionTickerDrawer";
import type { ClosePayload } from "@/types/trade";
import { WatchGroupView } from "@/components/groups/WatchGroupView";

export function PositionsView() {
  const { trades, closeTrade, deleteTrade, loading } = useTrades();
  const { groups, loading: groupsLoading } = useWatchGroups();
  const live = useLiveQuotes(trades);
  const optionMarks = useOptionMarks(trades);
  const [filter, setFilter] = useScreenOption("positionsFilter");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useScreenOption("positionsView");

  useEffect(() => {
    if (groupsLoading || selectedView === "positions") return;
    if (!groups.some((group) => group.id === selectedView)) {
      setSelectedView("positions");
    }
  }, [groups, groupsLoading, selectedView, setSelectedView]);

  const selectedGroup = groups.find((group) => group.id === selectedView);

  function changeView(value: string) {
    setSelectedView(value);
    setExpanded(null);
    setClosingId(null);
    setSelectedTradeId(null);
  }

  const visible = useMemo(
    () =>
      trades
        .filter((t) => (filter === "all" ? true : t.status === filter))
        .sort((a, b) => {
          const aOpen = a.status === "open";
          const bOpen = b.status === "open";
          if (aOpen && bOpen) {
            return a.expiry.localeCompare(b.expiry) || a.ticker.localeCompare(b.ticker);
          }
          if (filter === "all" && aOpen !== bOpen) return aOpen ? -1 : 1;
          const aDate = a.closeDate ?? a.openDate;
          const bDate = b.closeDate ?? b.openDate;
          return aDate < bDate ? 1 : -1;
        }),
    [trades, filter]
  );

  async function onConfirmClose(id: string, payload: ClosePayload) {
    await closeTrade(id, payload);
    setClosingId(null);
    setExpanded(null);
  }

  async function onDelete(id: string) {
    await deleteTrade(id);
    if (selectedTradeId === id) setSelectedTradeId(null);
    setClosingId(null);
    setExpanded(null);
  }

  return (
    <div>
      <div className="relative mb-4 max-w-[320px]">
        <select
          value={selectedView}
          onChange={(event) => changeView(event.target.value)}
          className="rounded-xl border border-otto-divider bg-otto-surface px-3.5 py-2.5 pr-9 text-sm font-bold"
          aria-label="Choose positions or tracker group"
        >
          <option value="positions">Positions</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-otto-text-faint"
        />
      </div>

      {selectedGroup ? (
        <WatchGroupView group={selectedGroup} />
      ) : (
        <>
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
            onTickerClick={() => setSelectedTradeId(t.id)}
            live={live[t.ticker]}
            optionMark={optionMarks[t.id]}
          />
        ))}
      </div>
      {selectedTradeId &&
        trades.find((trade) => trade.id === selectedTradeId) && (
          <PositionTickerDrawer
            trade={trades.find((trade) => trade.id === selectedTradeId)!}
            optionMark={optionMarks[selectedTradeId]}
            onClose={() => setSelectedTradeId(null)}
          />
        )}
        </>
      )}
    </div>
  );
}
