"use client";

import { useEffect, useMemo, useRef } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useOptionMarks } from "@/hooks/useOptionMarks";
import { useTickerQuotes } from "@/hooks/useLiveQuotes";
import { useTrades } from "@/hooks/useTrades";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { getSupabaseClient } from "@/lib/supabase";
import { fmtDate, fmtMoney, todayISO } from "@/lib/pnl";
import { positionAlert } from "@/lib/premiumPace";
import type {
  NotificationChannel,
  NotificationEventKind,
  SignalDraft,
} from "@/types/notification";

function daysUntil(date: string) {
  return Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(`${todayISO()}T00:00:00`).getTime()) /
      86_400_000
  );
}

function quietNow(start: string, end: string) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const parse = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const from = parse(start);
  const to = parse(end);
  return from <= to ? current >= from && current < to : current >= from || current < to;
}

export function NotificationEngine() {
  const { trades } = useTrades();
  const { groups } = useWatchGroups();
  const {
    preferences,
    signals,
    loading,
    fire,
    clearCondition,
  } = useNotifications();
  const marks = useOptionMarks(trades);
  const tickers = useMemo(
    () => [...new Set(groups.flatMap((group) => group.trackers.map((tracker) => tracker.ticker)))],
    [groups]
  );
  const quotes = useTickerQuotes(tickers);
  const activeRef = useRef(new Set<string>());
  const initializedRef = useRef(false);
  const dispatchedRef = useRef(new Set<string>());

  useEffect(() => {
    if (loading || initializedRef.current) return;
    for (const signal of signals) {
      if (signal.status === "open") dispatchedRef.current.add(signal.dedupeKey);
    }
    initializedRef.current = true;
  }, [loading, signals]);

  useEffect(() => {
    if (loading || !initializedRef.current || !preferences.masterEnabled) return;
    const drafts: SignalDraft[] = [];

    for (const trade of trades.filter((item) => item.status === "open")) {
      const alert = positionAlert(trade, marks[trade.id]?.mark);
      if (alert?.tier === "nearmax") {
        drafts.push({
          kind: "near_max",
          ticker: trade.ticker,
          tradeId: trade.id,
          groupId: null,
          title: `${trade.ticker} is near max profit`,
          message: alert.detail,
          severity: "success",
          dedupeKey: `near_max:${trade.id}`,
        });
      } else if (alert?.tier === "underwater" || alert?.tier === "critical") {
        drafts.push({
          kind: "position_risk",
          ticker: trade.ticker,
          tradeId: trade.id,
          groupId: null,
          title: `${trade.ticker} is ${alert.label.toLowerCase()}`,
          message: alert.detail,
          severity: alert.tier === "critical" ? "critical" : "warning",
          dedupeKey: `position_risk:${trade.id}:${alert.tier}`,
        });
      }

      const expiryDays = daysUntil(trade.expiry);
      if (expiryDays >= 0 && expiryDays <= preferences.expiryDays) {
        drafts.push({
          kind: "expiry_soon",
          ticker: trade.ticker,
          tradeId: trade.id,
          groupId: null,
          title: `${trade.ticker} expires ${expiryDays === 0 ? "today" : "soon"}`,
          message: `${fmtDate(trade.expiry)} · ${expiryDays} day${expiryDays === 1 ? "" : "s"} remaining`,
          severity: expiryDays <= 1 ? "critical" : "warning",
          dedupeKey: `expiry_soon:${trade.id}:${trade.expiry}`,
        });
      }
    }

    for (const group of groups) {
      for (const tracker of group.trackers) {
        const price = quotes[tracker.ticker]?.price;
        if (price && tracker.lowerTrigger != null && price < tracker.lowerTrigger) {
          drafts.push({
            kind: "price_range",
            ticker: tracker.ticker,
            tradeId: null,
            groupId: group.id,
            title: `${tracker.ticker} fell below your range`,
            message: `${fmtMoney(price)} is below ${fmtMoney(tracker.lowerTrigger)} in ${group.name}.`,
            severity: "warning",
            dedupeKey: `price_range:${group.id}:${tracker.id}:below`,
          });
        }
        if (price && tracker.upperTrigger != null && price > tracker.upperTrigger) {
          drafts.push({
            kind: "price_range",
            ticker: tracker.ticker,
            tradeId: null,
            groupId: group.id,
            title: `${tracker.ticker} rose above your range`,
            message: `${fmtMoney(price)} is above ${fmtMoney(tracker.upperTrigger)} in ${group.name}.`,
            severity: "warning",
            dedupeKey: `price_range:${group.id}:${tracker.id}:above`,
          });
        }
        if (tracker.earningsDate) {
          const earningsDays = daysUntil(tracker.earningsDate);
          if (earningsDays >= 0 && earningsDays <= preferences.earningsDays) {
            drafts.push({
              kind: "earnings_soon",
              ticker: tracker.ticker,
              tradeId: null,
              groupId: group.id,
              title: `${tracker.ticker} earnings approaching`,
              message: `${fmtDate(tracker.earningsDate)}${
                tracker.earningsTiming ? ` · ${tracker.earningsTiming}` : ""
              } · ${group.name}`,
              severity: "info",
              dedupeKey: `earnings_soon:${tracker.ticker}:${tracker.earningsDate}`,
            });
          }
        }
      }
    }

    const active = new Set(drafts.map((draft) => draft.dedupeKey));
    for (const oldKey of activeRef.current) {
      if (!active.has(oldKey)) {
        dispatchedRef.current.delete(oldKey);
        void clearCondition(oldKey);
      }
    }
    activeRef.current = active;

    for (const draft of drafts) {
      if (
        (draft.ticker && preferences.mutedTickers.includes(draft.ticker)) ||
        (draft.groupId && preferences.mutedGroupIds.includes(draft.groupId))
      ) {
        continue;
      }
      const event = preferences.events[draft.kind];
      const hasDestination =
        event.inApp || event.browser || event.email || event.discord || event.telegram;
      if (
        !event.enabled ||
        !hasDestination ||
        dispatchedRef.current.has(draft.dedupeKey)
      ) {
        continue;
      }
      dispatchedRef.current.add(draft.dedupeKey);
      void fire(draft);
      if (
        event.browser &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        !(
          preferences.quietHours.enabled &&
          quietNow(preferences.quietHours.start, preferences.quietHours.end)
        )
      ) {
        new Notification(draft.title, { body: draft.message });
      }
      for (const channel of ["email", "discord", "telegram"] as NotificationChannel[]) {
        if (!event[channel]) continue;
        void deliver(channel, draft.kind, draft.title, draft.message);
      }
    }
  }, [
    clearCondition,
    fire,
    groups,
    loading,
    marks,
    preferences,
    quotes,
    trades,
  ]);

  return null;
}

async function deliver(
  channel: NotificationChannel,
  kind: NotificationEventKind,
  title: string,
  message: string
) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return;
  await fetch("/api/notifications/deliver", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, kind, title, message }),
  }).catch(() => undefined);
}
