"use client";

import Link from "next/link";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationInbox() {
  const { signals, unreadCount, acknowledge, acknowledgeAll, preferences } =
    useNotifications();
  const visible = signals.filter(
    (signal) => preferences.events[signal.kind]?.inApp !== false
  );

  return (
    <div className="max-w-[720px]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Alerts</h1>
          <p className="mt-1 text-[12.5px] text-otto-text-faint">
            {unreadCount} active alert{unreadCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void acknowledgeAll()}
              className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
            >
              <CheckCheck size={14} />
              Clear all
            </button>
          )}
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-xs font-semibold text-otto-text-dim"
          >
            <Settings size={14} />
            Settings
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl bg-otto-surface px-4 py-10 text-center">
          <Bell size={20} className="mx-auto text-otto-text-faint" />
          <div className="mt-2 text-sm font-semibold">No alerts yet</div>
          <div className="mt-1 text-xs text-otto-text-faint">
            Price, position, expiry, and earnings alerts will appear here.
          </div>
        </div>
      ) : (
        visible.map((signal) => (
          <button
            key={signal.id}
            type="button"
            onClick={() => signal.status === "open" && void acknowledge(signal.id)}
            className={`flex w-full items-start gap-3 border-b border-otto-divider px-1 py-4 text-left ${
              signal.status === "open" ? "" : "opacity-55"
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
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-bold">{signal.title}</span>
                {signal.ticker && (
                  <span className="text-[10.5px] font-semibold text-otto-text-faint">
                    {signal.ticker}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-otto-text-dim">
                {signal.message}
              </span>
              <span className="mt-1.5 block text-[10.5px] text-otto-text-faint">
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(signal.firedAt))}
                {signal.status === "open" ? " · tap to clear" : " · cleared"}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
