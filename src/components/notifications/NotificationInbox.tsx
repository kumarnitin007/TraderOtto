"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Bell, CheckCheck, Settings, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { notificationGroupKey } from "@/lib/notificationSmart";
import type { NotificationSignal } from "@/types/notification";

type Folder = "inbox" | "archive";
type AlertTarget = { ticker: string; kind: string };

export function NotificationInbox() {
  const {
    signals,
    unreadCount,
    acknowledge,
    acknowledgeAll,
    hideMany,
    preferences,
  } = useNotifications();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [target, setTarget] = useState<AlertTarget | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticker = params.get("ticker");
    const kind = params.get("kind");
    if (ticker && kind) {
      setTarget({ ticker: ticker.toUpperCase(), kind });
      setFolder("inbox");
    }
  }, []);

  const visible = useMemo(
    () =>
      signals.filter(
        (signal) => preferences.events[signal.kind]?.inApp !== false
      ),
    [preferences.events, signals]
  );
  const inbox = visible.filter((signal) => signal.status === "open");
  const archive = visible.filter((signal) => signal.status !== "open");
  const inboxGroups = useMemo(() => {
    const groups = new Map<
      string,
      { signal: NotificationSignal; ids: string[]; count: number }
    >();
    for (const signal of inbox) {
      const key = notificationGroupKey(signal);
      const existing = groups.get(key);
      if (existing) {
        existing.ids.push(signal.id);
        existing.count += 1;
      } else {
        groups.set(key, { signal, ids: [signal.id], count: 1 });
      }
    }
    return Array.from(groups.values());
  }, [inbox]);
  const baseItems =
    folder === "inbox"
      ? inboxGroups
      : archive.map((signal) => ({ signal, ids: [signal.id], count: 1 }));
  const items = target
    ? baseItems.slice().sort((a, b) => {
        const aMatch =
          a.signal.ticker === target.ticker && a.signal.kind === target.kind;
        const bMatch =
          b.signal.ticker === target.ticker && b.signal.kind === target.kind;
        return Number(bMatch) - Number(aMatch);
      })
    : baseItems;
  const targetFound = Boolean(
    target &&
      items.some(
        (item) =>
          item.signal.ticker === target.ticker &&
          item.signal.kind === target.kind
      )
  );

  return (
    <div className="max-w-[720px]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Alerts</h1>
          <p className="mt-1 text-[12.5px] text-otto-text-faint">
            {unreadCount} active · {archive.length} archived
          </p>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
        >
          <Settings size={14} />
          Settings
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-full bg-otto-surface p-1">
          <FolderTab
            label={`Inbox (${inboxGroups.length})`}
            active={folder === "inbox"}
            onClick={() => setFolder("inbox")}
          />
          <FolderTab
            label={`Archive (${archive.length})`}
            active={folder === "archive"}
            onClick={() => setFolder("archive")}
          />
        </div>
        {folder === "inbox" && inbox.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void acknowledgeAll()}
              className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
            >
              <Archive size={14} />
              Archive all
            </button>
            <button
              type="button"
              onClick={() => void hideMany(inbox.map((signal) => signal.id))}
              className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
            >
              <Trash2 size={14} />
              Remove all
            </button>
          </div>
        )}
        {folder === "archive" && archive.length > 0 && (
          <button
            type="button"
            onClick={() => void hideMany(archive.map((signal) => signal.id))}
            className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
          >
            <Trash2 size={14} />
            Empty archive
          </button>
        )}
      </div>

      {target && !targetFound && (
        <div className="mb-3 rounded-xl bg-otto-surface px-3 py-2 text-xs text-otto-text-dim">
          No active {target.ticker} alert matches this tag yet. The position
          will appear here when the configured threshold creates an alert.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl bg-otto-surface px-4 py-10 text-center">
          <Bell size={20} className="mx-auto text-otto-text-faint" />
          <div className="mt-2 text-sm font-semibold">
            {folder === "inbox" ? "Inbox is empty" : "Archive is empty"}
          </div>
          <div className="mt-1 text-xs text-otto-text-faint">
            {folder === "inbox"
              ? "Price, position, expiry, and earnings alerts will appear here."
              : "Archived alerts stay here until you remove them from view."}
          </div>
        </div>
      ) : (
        items.map((item) => (
          <AlertRow
            key={item.signal.id}
            signal={item.signal}
            count={item.count}
            highlighted={
              item.signal.ticker === target?.ticker &&
              item.signal.kind === target?.kind
            }
            folder={folder}
            onArchive={() =>
              void Promise.all(item.ids.map((id) => acknowledge(id)))
            }
            onRemove={() => void hideMany(item.ids)}
          />
        ))
      )}
    </div>
  );
}

function FolderTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? "bg-otto-bg text-otto-text" : "text-otto-text-dim"
      }`}
    >
      {label}
    </button>
  );
}

function AlertRow({
  signal,
  count,
  highlighted,
  folder,
  onArchive,
  onRemove,
}: {
  signal: NotificationSignal;
  count: number;
  highlighted: boolean;
  folder: Folder;
  onArchive: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex w-full items-start gap-3 border-b px-2 py-4 ${
        highlighted
          ? "rounded-xl border-otto-green bg-otto-green-soft"
          : "border-otto-divider"
      }`}
    >
      <span
        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
          signal.severity === "critical"
            ? "bg-otto-red"
            : signal.severity === "warning"
              ? "bg-otto-amber"
              : signal.severity === "success"
                ? "bg-otto-green"
                : "bg-otto-text-faint"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold">{signal.title}</span>
          {count > 1 && (
            <span className="rounded-full bg-otto-surface px-1.5 py-0.5 text-[10px] font-bold text-otto-text-dim">
              {count} similar
            </span>
          )}
          {signal.ticker && (
            <span className="text-[10.5px] font-semibold text-otto-text-faint">
              {signal.ticker}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs leading-relaxed text-otto-text-dim">
          {signal.message}
        </div>
        <div className="mt-1.5 text-[10.5px] text-otto-text-faint">
          {new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(signal.firedAt))}
          {folder === "archive" ? " · archived" : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {folder === "inbox" && (
          <button
            type="button"
            onClick={onArchive}
            className="inline-flex items-center gap-1 rounded-full border border-otto-divider px-2.5 py-1 text-[10.5px] font-semibold text-otto-text-dim"
          >
            <CheckCheck size={12} />
            Archive
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-full border border-otto-divider px-2.5 py-1 text-[10.5px] font-semibold text-otto-text-dim"
        >
          <Trash2 size={12} />
          Remove
        </button>
      </div>
    </div>
  );
}
