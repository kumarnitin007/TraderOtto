"use client";

import { useState } from "react";
import { Bell, Check, Send } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useWatchGroups } from "@/hooks/useWatchGroups";
import { getSupabaseClient } from "@/lib/supabase";
import { EVENT_LABELS } from "@/lib/notificationDefaults";
import { TelegramSetup } from "@/components/settings/TelegramSetup";
import type {
  NotificationChannel,
  NotificationEventKind,
  NotificationPreferences,
} from "@/types/notification";

const CHANNELS: { id: keyof NotificationPreferences["events"]["price_range"]; label: string }[] = [
  { id: "inApp", label: "In app" },
  { id: "browser", label: "Browser" },
  { id: "email", label: "Email" },
  { id: "discord", label: "Discord" },
  { id: "telegram", label: "Telegram" },
];

export function NotificationSettings() {
  const { preferences, updatePreferences, error } = useNotifications();
  const { groups } = useWatchGroups();
  const [notice, setNotice] = useState("");
  const [testing, setTesting] = useState<NotificationChannel | null>(null);

  async function save(next: NotificationPreferences) {
    setNotice("");
    await updatePreferences(next);
    setNotice("Preferences saved.");
  }

  function patchEvent(
    kind: NotificationEventKind,
    patch: Partial<NotificationPreferences["events"][NotificationEventKind]>
  ) {
    void save({
      ...preferences,
      events: {
        ...preferences.events,
        [kind]: { ...preferences.events[kind], ...patch },
      },
    });
  }

  async function enableChannelOnLiveAlerts(
    channel: "email" | "discord" | "telegram"
  ) {
    const events = Object.fromEntries(
      (Object.keys(EVENT_LABELS) as NotificationEventKind[]).map((kind) => [
        kind,
        {
          ...preferences.events[kind],
          ...(preferences.events[kind].enabled ? { [channel]: true } : {}),
        },
      ])
    ) as NotificationPreferences["events"];
    await save({ ...preferences, events });
    setNotice(
      `${channel[0].toUpperCase()}${channel.slice(1)} is now on for every enabled alert type.`
    );
  }

  async function requestBrowser() {
    if (typeof Notification === "undefined") {
      setNotice("Browser notifications are not supported here.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(
      permission === "granted"
        ? "Browser notifications enabled."
        : "Browser notification permission was not granted."
    );
  }

  async function test(channel: NotificationChannel) {
    if (channel === "browser") {
      await requestBrowser();
      if (Notification.permission === "granted") {
        new Notification("Trader Otto test", { body: "Your browser alerts are working." });
      }
      return;
    }
    setTesting(channel);
    setNotice("");
    try {
      await updatePreferences(preferences);
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch("/api/notifications/deliver", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          kind: "price_range",
          title: "Trader Otto test",
          message: `Your ${channel} notification channel is working.`,
          test: true,
        }),
      });
      const body = (await response.json()) as { error?: string };
      setNotice(response.ok ? `Test sent to ${channel}.` : body.error ?? "Test failed.");
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="max-w-[760px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold">Notification preferences</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-otto-text-faint">
            Alerts are recorded once when a condition starts and can fire again after it clears.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-otto-text-dim">
          <input
            type="checkbox"
            checked={preferences.masterEnabled}
            onChange={(event) =>
              void save({ ...preferences, masterEnabled: event.target.checked })
            }
            className="h-4 w-4"
          />
          All alerts
        </label>
      </div>

      <section className="space-y-3">
        {(Object.keys(EVENT_LABELS) as NotificationEventKind[]).map((kind) => {
          const event = preferences.events[kind];
          return (
            <div key={kind} className="rounded-xl border border-otto-divider p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{EVENT_LABELS[kind].label}</div>
                  <div className="mt-0.5 text-[11.5px] text-otto-text-faint">
                    {EVENT_LABELS[kind].description}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={event.enabled}
                  onChange={(input) => patchEvent(kind, { enabled: input.target.checked })}
                  className="h-4 w-4 shrink-0"
                  aria-label={`Enable ${EVENT_LABELS[kind].label}`}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {CHANNELS.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-center gap-1.5 text-[11.5px] font-medium text-otto-text-dim"
                  >
                    <input
                      type="checkbox"
                      checked={
                        typeof event[channel.id] === "boolean"
                          ? Boolean(event[channel.id])
                          : false
                      }
                      disabled={!event.enabled}
                      onChange={(input) =>
                        patchEvent(kind, { [channel.id]: input.target.checked })
                      }
                      className="h-3.5 w-3.5"
                    />
                    {channel.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 rounded-xl bg-otto-surface p-4">
        <h2 className="text-sm font-bold">Mute selected alerts</h2>
        <p className="mt-1 text-[11.5px] text-otto-text-faint">
          Muted tickers and lists still appear in the app; they just do not create alerts.
        </p>
        <Field label="Muted tickers (comma separated)">
          <input
            value={preferences.mutedTickers.join(", ")}
            onChange={(event) =>
              void save({
                ...preferences,
                mutedTickers: event.target.value
                  .split(",")
                  .map((ticker) => ticker.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
            placeholder="TSLA, NVDA"
          />
        </Field>
        {groups.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 text-[11px] font-medium text-otto-text-faint">
              Muted watch lists
            </div>
            <div className="flex flex-wrap gap-3">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-otto-text-dim"
                >
                  <input
                    type="checkbox"
                    checked={preferences.mutedGroupIds.includes(group.id)}
                    onChange={(event) =>
                      void save({
                        ...preferences,
                        mutedGroupIds: event.target.checked
                          ? [...preferences.mutedGroupIds, group.id]
                          : preferences.mutedGroupIds.filter((id) => id !== group.id),
                      })
                    }
                    className="h-3.5 w-3.5"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-otto-surface p-4">
        <h2 className="text-sm font-bold">Timing</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Expiry alert (days before)">
            <input
              type="number"
              min={0}
              max={30}
              value={preferences.expiryDays}
              onChange={(event) =>
                void save({ ...preferences, expiryDays: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Earnings alert (days before)">
            <input
              type="number"
              min={0}
              max={30}
              value={preferences.earningsDays}
              onChange={(event) =>
                void save({ ...preferences, earningsDays: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Assignment cash limit ($)">
            <input
              type="number"
              min={0}
              step={1000}
              value={preferences.assignmentCashThreshold}
              onChange={(event) =>
                void save({
                  ...preferences,
                  assignmentCashThreshold: Math.max(
                    0,
                    Number(event.target.value) || 0
                  ),
                })
              }
            />
            <div className="mt-1 text-[10px] text-otto-text-faint">
              0 disables this alert.
            </div>
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-otto-text-dim">
          <input
            type="checkbox"
            checked={preferences.quietHours.enabled}
            onChange={(event) =>
              void save({
                ...preferences,
                quietHours: { ...preferences.quietHours, enabled: event.target.checked },
              })
            }
            className="h-4 w-4"
          />
          Quiet hours for browser notifications
        </label>
        {preferences.quietHours.enabled && (
          <div className="mt-2 grid grid-cols-2 gap-4">
            <Field label="Starts">
              <input
                type="time"
                value={preferences.quietHours.start}
                onChange={(event) =>
                  void save({
                    ...preferences,
                    quietHours: { ...preferences.quietHours, start: event.target.value },
                  })
                }
              />
            </Field>
            <Field label="Ends">
              <input
                type="time"
                value={preferences.quietHours.end}
                onChange={(event) =>
                  void save({
                    ...preferences,
                    quietHours: { ...preferences.quietHours, end: event.target.value },
                  })
                }
              />
            </Field>
          </div>
        )}
      </section>

      <Channel
        title="Browser"
        description="Works while Trader Otto is open and your browser has permission."
        action={() => void test("browser")}
        configured={
          typeof Notification !== "undefined" && Notification.permission === "granted"
        }
      />

      <Channel
        title="Email"
        description="No domain needed for testing: server From is onboarding@resend.dev. Delivery email must be the address on your Resend account. Then turn on Email for each alert type, or Use for live alerts."
        action={() => void test("email")}
        busy={testing === "email"}
        configured={Boolean(preferences.emailAddress)}
        extraAction={{
          label: "Use for live alerts",
          onClick: () => void enableChannelOnLiveAlerts("email"),
        }}
      >
        <Field label="Delivery email">
          <input
            type="email"
            value={preferences.emailAddress}
            onChange={(event) =>
              void save({ ...preferences, emailAddress: event.target.value.trim() })
            }
            placeholder="you@example.com"
          />
        </Field>
      </Channel>

      <Channel
        title="Discord"
        description="Create a webhook in Discord → Channel settings → Integrations. It is stored in your private profile settings. Test does not turn Discord on for live alerts."
        action={() => void test("discord")}
        busy={testing === "discord"}
        configured={Boolean(preferences.discordWebhook)}
        extraAction={{
          label: "Use for live alerts",
          onClick: () => void enableChannelOnLiveAlerts("discord"),
        }}
      >
        <Field label="Webhook URL">
          <input
            type="password"
            value={preferences.discordWebhook}
            onChange={(event) =>
              void save({ ...preferences, discordWebhook: event.target.value.trim() })
            }
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>
      </Channel>

      <Channel
        title="Telegram"
        description="Otto uses one shared bot (token stays on the server). You only connect your chat. A successful test does not send live alerts until you enable Telegram on each alert type or tap Use for live alerts."
        action={() => void test("telegram")}
        busy={testing === "telegram"}
        configured={Boolean(preferences.telegramChatId)}
        extraAction={{
          label: "Use for live alerts",
          onClick: () => void enableChannelOnLiveAlerts("telegram"),
        }}
      >
        <TelegramSetup
          preferences={preferences}
          save={save}
          notice={setNotice}
        />
      </Channel>

      {(notice || error) && (
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-otto-text-dim">
          {!error && <Check size={14} className="text-otto-green" />}
          {error || notice}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium text-otto-text-faint">
      {label}
      {children}
    </label>
  );
}

function Channel({
  title,
  description,
  configured,
  busy,
  action,
  extraAction,
  children,
}: {
  title: string;
  description: string;
  configured: boolean;
  busy?: boolean;
  action: () => void;
  extraAction?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-xl border border-otto-divider p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Bell size={14} />
            {title}
            <span className={configured ? "text-otto-green" : "text-otto-text-faint"}>
              · {configured ? "configured" : "not configured"}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={action}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-1.5 text-[11px] font-semibold text-otto-text-dim disabled:opacity-50"
          >
            <Send size={12} />
            {busy ? "Sending…" : "Test"}
          </button>
          {extraAction && (
            <button
              type="button"
              onClick={extraAction.onClick}
              className="rounded-full border border-otto-divider px-3 py-1.5 text-[11px] font-semibold text-otto-text-dim"
            >
              {extraAction.label}
            </button>
          )}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
