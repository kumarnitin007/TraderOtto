"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, ChevronRight, LoaderCircle, X } from "lucide-react";
import { useTickerQuotes } from "@/hooks/useLiveQuotes";
import { useTrades } from "@/hooks/useTrades";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { TickerResearch } from "@/components/ticker/TickerResearch";
import { fmtDate, fmtMoney, tickerAvatarColor } from "@/lib/pnl";
import type { TickerDetails } from "@/types/tickerDetails";
import type { WatchGroup, WatchTracker } from "@/types/watchGroup";

function breach(tracker: WatchTracker, price?: number) {
  if (!price) return null;
  if (tracker.lowerTrigger != null && price < tracker.lowerTrigger) return "below";
  if (tracker.upperTrigger != null && price > tracker.upperTrigger) return "above";
  return null;
}

export function WatchGroupView({ group }: { group: WatchGroup }) {
  const { trades } = useTrades();
  const { updateTracker } = useWatchGroups();
  const tickers = useMemo(() => group.trackers.map((tracker) => tracker.ticker), [group]);
  const quotes = useTickerQuotes(tickers);
  const [selected, setSelected] = useState<WatchTracker | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const alertStates = useRef(new Map<string, string>());

  useEffect(() => {
    setSelected((current) =>
      current ? group.trackers.find((tracker) => tracker.id === current.id) ?? null : null
    );
  }, [group.trackers]);

  useEffect(() => {
    setNotificationPermission(
      typeof Notification === "undefined" ? "unsupported" : Notification.permission
    );
  }, []);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    for (const tracker of group.trackers) {
      const price = quotes[tracker.ticker]?.price;
      const state = breach(tracker, price);
      const key = `trader-otto:alert:${group.id}:${tracker.id}`;
      const last = alertStates.current.get(key);
      if (state && last !== state) {
        new Notification(`${tracker.ticker} price alert`, {
          body: `${tracker.ticker} is ${state} your range at ${fmtMoney(price ?? 0)}.`,
        });
        alertStates.current.set(key, state);
      } else if (!state && last) {
        alertStates.current.delete(key);
      }
    }
  }, [group.id, group.trackers, notificationPermission, quotes]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold">{group.name}</div>
          <div className="mt-0.5 text-xs text-otto-text-faint">
            {group.trackers.length} ticker{group.trackers.length === 1 ? "" : "s"} · tap for details
          </div>
        </div>
        {notificationPermission === "default" && (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-otto-divider px-3 py-1.5 text-[11px] font-semibold text-otto-text-dim"
          >
            <Bell size={13} />
            Enable alerts
          </button>
        )}
      </div>

      {group.trackers.length === 0 && (
        <div className="py-10 text-center text-sm text-otto-text-faint">
          Add tickers to this group from Log trade → Groups.
        </div>
      )}

      {group.trackers.map((tracker) => {
        const quote = quotes[tracker.ticker];
        const alert = breach(tracker, quote?.price);
        const openTrades = trades.filter(
          (trade) => trade.status === "open" && trade.ticker === tracker.ticker
        ).length;
        return (
          <button
            key={tracker.id}
            type="button"
            onClick={() => setSelected(tracker)}
            className="flex w-full items-center gap-3 border-b border-otto-divider px-1 py-3.5 text-left"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: tickerAvatarColor(tracker.ticker) }}
            >
              {tracker.ticker.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{tracker.ticker}</span>
                {alert && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-otto-red-soft px-2 py-0.5 text-[10px] font-semibold text-otto-red">
                    <AlertTriangle size={10} />
                    {alert} range
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-otto-text-faint">
                {tracker.lowerTrigger != null || tracker.upperTrigger != null
                  ? `${tracker.lowerTrigger == null ? "Any" : `$${tracker.lowerTrigger}`} – ${
                      tracker.upperTrigger == null ? "Any" : `$${tracker.upperTrigger}`
                    }`
                  : "No price range set"}
                {openTrades ? ` · ${openTrades} open trade${openTrades === 1 ? "" : "s"}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-bold">
                {quote?.price ? `$${quote.price.toFixed(2)}` : "—"}
              </div>
              <div
                className={`mt-0.5 text-[11px] ${
                  quote?.dir === 1
                    ? "text-otto-green"
                    : quote?.dir === -1
                      ? "text-otto-red"
                      : "text-otto-text-faint"
                }`}
              >
                {quote?.price ? "live" : "unavailable"}
              </div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-otto-text-faint" />
          </button>
        );
      })}

      {selected && (
        <TickerDrawer
          group={group}
          tracker={selected}
          fallbackPrice={quotes[selected.ticker]?.price}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => updateTracker(group.id, selected.id, patch)}
        />
      )}
    </div>
  );
}

function TickerDrawer({
  group,
  tracker,
  fallbackPrice,
  onClose,
  onUpdate,
}: {
  group: WatchGroup;
  tracker: WatchTracker;
  fallbackPrice?: number;
  onClose: () => void;
  onUpdate: (
    patch: Partial<Pick<WatchTracker, "lowerTrigger" | "upperTrigger" | "notes">>
  ) => void;
}) {
  const { trades } = useTrades();
  const [details, setDetails] = useState<TickerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [lower, setLower] = useState(tracker.lowerTrigger?.toString() ?? "");
  const [upper, setUpper] = useState(tracker.upperTrigger?.toString() ?? "");
  const [notes, setNotes] = useState(tracker.notes);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/ticker/${encodeURIComponent(tracker.ticker)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => !cancelled && setDetails(data as TickerDetails | null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tracker.ticker]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const price = details?.price ?? fallbackPrice;
  const openTrades = trades.filter(
    (trade) => trade.status === "open" && trade.ticker === tracker.ticker
  );
  const alert = breach(tracker, price);

  function save() {
    onUpdate({
      lowerTrigger: lower ? Number(lower) : null,
      upperTrigger: upper ? Number(upper) : null,
      notes,
    });
  }

  return (
    <div className="fixed inset-0 z-30">
      <button
        type="button"
        aria-label="Close ticker details"
        onClick={onClose}
        className="absolute inset-0 bg-black/65"
      />
      <aside className="otto-drawer absolute bottom-0 right-0 top-0 w-full max-w-[460px] overflow-y-auto border-l border-otto-divider bg-otto-bg px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] shadow-2xl desk:px-5">
        <div className="sticky top-0 z-10 flex items-start justify-between bg-otto-bg pb-3">
          <div>
            <div className="text-xs font-semibold text-otto-text-faint">{group.name}</div>
            <h2 className="mt-1 text-2xl font-extrabold">{tracker.ticker}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface text-otto-text-dim"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-2 rounded-2xl bg-otto-surface p-4">
          <div className="text-[32px] font-extrabold">
            {price ? `$${price.toFixed(2)}` : "—"}
          </div>
          {details?.change != null && details.changePct != null && (
            <div
              className={`mt-1 text-sm font-semibold ${
                details.change >= 0 ? "text-otto-green" : "text-otto-red"
              }`}
            >
              {details.change >= 0 ? "+" : ""}
              {fmtMoney(details.change)} ({details.changePct.toFixed(2)}%)
            </div>
          )}
          {loading && (
            <div className="mt-2 flex items-center gap-2 text-xs text-otto-text-faint">
              <LoaderCircle size={13} className="otto-spin" /> Loading market details…
            </div>
          )}
          {!loading && details?.marketSource === "unavailable" && (
            <div className="mt-2 text-xs text-otto-red">
              Alpaca offline — real-time data unavailable.
            </div>
          )}
          {details?.market && (
            <div className="mt-2 text-xs text-otto-text-dim">
              Market {details.market.isOpen ? "open" : "closed"} ·{" "}
              {details.market.isOpen ? "closes" : "opens"}{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }).format(
                new Date(
                  details.market.isOpen
                    ? details.market.nextClose
                    : details.market.nextOpen
                )
              )}
            </div>
          )}
          {alert && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-otto-red-soft px-3 py-2 text-xs font-semibold text-otto-red">
              <AlertTriangle size={14} />
              Price is {alert} your defined range.
            </div>
          )}
        </div>

        <section className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-wider text-otto-text-faint">
            Price alerts
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="text-[11px] text-otto-text-faint">
              Alert below
              <input
                type="number"
                value={lower}
                onChange={(event) => setLower(event.target.value)}
                placeholder="No lower limit"
              />
            </label>
            <label className="text-[11px] text-otto-text-faint">
              Alert above
              <input
                type="number"
                value={upper}
                onChange={(event) => setUpper(event.target.value)}
                placeholder="No upper limit"
              />
            </label>
          </div>
        </section>

        <section className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-wider text-otto-text-faint">
            Open trades
          </div>
          <div className="mt-2 rounded-xl bg-otto-surface p-3.5 text-sm">
            {openTrades.length
              ? openTrades.map((trade) => (
                  <div key={trade.id} className="mb-1 last:mb-0">
                    {trade.strategy} · {trade.shortStrike}
                    {trade.longStrike ? `/${trade.longStrike}` : ""} · exp {fmtDate(trade.expiry)}
                  </div>
                ))
              : "No open trades for this ticker."}
          </div>
        </section>

        <section className="mt-7">
          <label className="text-[11px] font-bold uppercase tracking-wider text-otto-text-faint">
            Tracker notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Setup, catalyst, entry plan…"
            className="mt-2"
          />
        </section>

        <button
          type="button"
          onClick={save}
          className="mt-6 w-full rounded-full bg-otto-green py-3 text-sm font-bold text-black"
        >
          Save tracker
        </button>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Metric label="Open" value={details?.open} />
          <Metric label="Previous close" value={details?.previousClose} />
          <Metric label="Day high" value={details?.high} />
          <Metric label="Day low" value={details?.low} />
        </div>

        <section className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-wider text-otto-text-faint">
            Upcoming earnings
          </div>
          <div className="mt-2 rounded-xl bg-otto-surface p-3.5">
            {details?.earnings ? (
              <>
                <div className="font-bold">{fmtDate(details.earnings.date)}</div>
                <div className="mt-1 text-xs text-otto-text-dim">
                  {details.earnings.timing}
                  {details.earnings.epsForecast
                    ? ` · EPS estimate ${details.earnings.epsForecast}`
                    : ""}
                </div>
                {details.earnings.fiscalQuarter && (
                  <div className="mt-1 text-xs text-otto-text-faint">
                    Fiscal quarter {details.earnings.fiscalQuarter}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-otto-text-faint">
                No earnings found in the next 3 months.
              </div>
            )}
          </div>
        </section>

        <TickerResearch details={details} />
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg bg-otto-surface px-3 py-2.5">
      <div className="text-[10.5px] text-otto-text-faint">{label}</div>
      <div className="mt-1 text-sm font-semibold">
        {typeof value === "number" ? `$${value.toFixed(2)}` : "—"}
      </div>
    </div>
  );
}
