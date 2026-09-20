"use client";

import { useEffect, useMemo, useState } from "react";
import { useScreenOption } from "@/hooks/useScreenOption";
import { ChevronDown } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { Tabs } from "@/components/ui/Tabs";
import { AssignmentCashCard } from "@/components/ui/AssignmentCashCard";
import { TradeScopeToggle } from "@/components/ui/TradeScopeToggle";
import { TradeRow } from "@/components/positions/TradeRow";
import { PositionTickerDrawer } from "@/components/positions/PositionTickerDrawer";
import { PositionsScreenshotImport } from "@/components/positions/PositionsScreenshotImport";
import type { ClosePayload } from "@/types/trade";
import { WatchGroupView } from "@/components/groups/WatchGroupView";
import {
  matchesPositionFocus,
  positionFocus,
  type PositionFocusFilter,
} from "@/lib/positionFocus";
import { assignmentDetail } from "@/lib/roi";
import { tradesInScope } from "@/lib/tradeScope";
import { useNotifications } from "@/hooks/useNotifications";

/** 10 letters keeps Open + two or three list names readable on a phone row. */
const LIST_TAB_CHARS = 10;
const PINNED_LISTS = 3;
const FOCUS_OPTIONS: { value: PositionFocusFilter; label: string }[] = [
  { value: "focus", label: "Focus" },
  { value: "near", label: "Near" },
  { value: "time", label: "Time" },
  { value: "losing", label: "Losing" },
  { value: "all", label: "All" },
];

function tabLabel(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= LIST_TAB_CHARS) return trimmed;
  return `${trimmed.slice(0, LIST_TAB_CHARS).trimEnd()}…`;
}

function MoreLists({
  extraGroups,
  selectedView,
  onChange,
}: {
  extraGroups: { id: string; name: string }[];
  selectedView: string;
  onChange: (value: string) => void;
}) {
  if (extraGroups.length === 0) return null;
  const extraSelected = extraGroups.some((group) => group.id === selectedView);
  return (
    <div className="relative">
      <select
        value={extraSelected ? selectedView : ""}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        className={`appearance-none rounded-none border-none bg-transparent py-0 pr-5 text-sm font-semibold ${
          extraSelected ? "text-otto-text" : "text-otto-text-faint"
        }`}
        aria-label="More lists"
      >
        <option value="" disabled>
          More
        </option>
        {extraGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-otto-text-faint"
      />
    </div>
  );
}

export function PositionsView() {
  const { trades, closeTrade, deleteTrade, loading } = useTrades();
  const { groups, loading: groupsLoading } = useWatchGroups();
  const { preferences } = useNotifications();
  const live = useLiveQuotes(trades);
  const optionMarks = useOptionMarks(trades);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [focusFilter, setFocusFilter] = useScreenOption("positionsFocus");
  const [selectedView, setSelectedView] = useScreenOption("positionsView");
  const [tradeScope] = useScreenOption("tradeScope");
  const scopedTrades = useMemo(
    () => tradesInScope(trades, tradeScope),
    [tradeScope, trades]
  );

  const pinnedGroups = groups.slice(0, PINNED_LISTS);
  const extraGroups = groups.slice(PINNED_LISTS);

  useEffect(() => {
    if (groupsLoading || selectedView === "positions") return;
    if (!groups.some((group) => group.id === selectedView)) {
      setSelectedView("positions");
    }
  }, [groups, groupsLoading, selectedView, setSelectedView]);

  const selectedGroup = groups.find((group) => group.id === selectedView);
  const assignment = useMemo(
    () => assignmentDetail(scopedTrades),
    [scopedTrades]
  );

  function changeView(value: string) {
    setSelectedView(value);
    setExpanded(null);
    setClosingId(null);
    setSelectedTradeId(null);
  }

  const openWithFocus = useMemo(
    () =>
      scopedTrades
        .filter((trade) => trade.status === "open")
        .map((trade) => ({
          trade,
          focus: positionFocus(
            trade,
            live[trade.ticker],
            optionMarks[trade.id],
            preferences.positionRiskThresholds
          ),
        }))
        .sort(
          (a, b) =>
            a.trade.expiry.localeCompare(b.trade.expiry) ||
            a.trade.ticker.localeCompare(b.trade.ticker)
        ),
    [scopedTrades, live, optionMarks, preferences.positionRiskThresholds]
  );
  const visible = useMemo(
    () =>
      openWithFocus
        .filter(({ focus }) => matchesPositionFocus(focus, focusFilter))
        .map(({ trade }) => trade),
    [focusFilter, openWithFocus]
  );
  const focusCounts = useMemo(
    () =>
      Object.fromEntries(
        FOCUS_OPTIONS.map((option) => [
          option.value,
          openWithFocus.filter(({ focus }) =>
            matchesPositionFocus(focus, option.value)
          ).length,
        ])
      ) as Record<PositionFocusFilter, number>,
    [openWithFocus]
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
      <div className="mb-3.5">
        <Tabs
          value={selectedView}
          onChange={changeView}
          end={
            extraGroups.length > 0 ? (
              <MoreLists
                extraGroups={extraGroups}
                selectedView={selectedView}
                onChange={changeView}
              />
            ) : undefined
          }
          options={[
            { value: "positions", label: "Open", title: "Open positions" },
            ...pinnedGroups.map((group) => ({
              value: group.id,
              label: tabLabel(group.name),
              title: group.name,
            })),
          ]}
        />
      </div>

      {selectedGroup ? (
        <WatchGroupView group={selectedGroup} />
      ) : (
        <>
          <div className="mb-2 overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-2">
              <TradeScopeToggle className="shrink-0" compact spreadsFirst />
              <div className="inline-flex shrink-0 rounded-full border border-otto-divider p-0.5">
              {FOCUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFocusFilter(option.value);
                    setExpanded(null);
                    setClosingId(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    focusFilter === option.value
                      ? "bg-otto-text text-otto-bg"
                      : "text-otto-text-dim"
                  }`}
                >
                  {option.label} {focusCounts[option.value]}
                </button>
              ))}
              </div>
            </div>
          </div>
          <div className="mb-2 px-1 text-[11px] text-otto-text-faint">
            {focusFilter === "focus"
              ? `Within ${preferences.positionRiskThresholds.watchStrikeDistancePct}% of a short strike, ${preferences.positionRiskThresholds.watchTimeUsedPct}% of duration used, or currently losing.`
              : focusFilter === "near"
                ? `Stock is within ${preferences.positionRiskThresholds.watchStrikeDistancePct}% of the nearest short strike.`
                : focusFilter === "time"
                  ? `${preferences.positionRiskThresholds.watchTimeUsedPct}% or more of the open-to-expiry duration has been used.`
                  : focusFilter === "losing"
                    ? "Live option mark shows an unrealized loss."
                    : "Every open position."}
          </div>

          {!loading && openWithFocus.length === 0 && (
            <div className="px-1 py-10 text-center text-sm text-otto-text-faint">
              No open trades. Closed trades stay on Performance.
            </div>
          )}
          {!loading && openWithFocus.length > 0 && visible.length === 0 && (
            <div className="px-1 py-8 text-center text-sm text-otto-text-faint">
              No positions match this attention filter. Choose All to see every
              open position.
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
                riskThresholds={preferences.positionRiskThresholds}
              />
            ))}
          </div>
          <AssignmentCashCard detail={assignment} className="mb-3 mt-5" />
          <PositionsScreenshotImport quotes={live} marks={optionMarks} />
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
