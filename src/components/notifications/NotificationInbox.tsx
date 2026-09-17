"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Bell, CheckCheck, Settings, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationSignal } from "@/types/notification";

type Folder = "inbox" | "archive";

export function NotificationInbox() {
  const {
    signals,
    unreadCount,
    acknowledge,
    acknowledgeAll,
    hide,
    hideMany,
    preferences,
  } = useNotifications();
  const [folder, setFolder] = useState<Folder>("inbox");

  const visible = useMemo(
    () =>
      signals.filter(
        (signal) => preferences.events[signal.kind]?.inApp !== false
      ),
    [preferences.events, signals]
  );
  const inbox = visible.filter((signal) => signal.status === "open");
  const archive = visible.filter((signal) => signal.status !== "open");
  const items = folder === "inbox" ? inbox : archive;

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
            label={`Inbox (${inbox.length})`}
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
        items.map((signal) => (
          <AlertRow
            key={signal.id}
            signal={signal}
            folder={folder}
            onArchive={() => void acknowledge(signal.id)}
            onRemove={() => void hide(signal.id)}
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
  folder,
  onArchive,
  onRemove,
}: {
  signal: NotificationSignal;
  folder: Folder;
  onArchive: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex w-full items-start gap-3 border-b border-otto-divider px-1 py-4">
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
