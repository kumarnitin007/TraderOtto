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

type ChannelKey = "inApp" | "browser" | "email" | "discord" | "telegram";
const CHANNELS: { id: ChannelKey; label: string }[] = [
  { id: "inApp", label: "In app" },
  { id: "browser", label: "Browser" },
  { id: "email", label: "Email" },
  { id: "discord", label: "Discord" },
  { id: "telegram", label: "Telegram" },
];

export type TraderSettingsSection = "alerts" | "muted" | "risk" | "timing" | "data";

export function NotificationSettings({
  section,
}: {
  section?: TraderSettingsSection;
}) {
  const { preferences, updatePreferences, error } = useNotifications();
  const { groups } = useWatchGroups();
  const [notice, setNotice] = useState("");
  const [testing, setTesting] = useState<NotificationChannel | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<ChannelKey>("inApp");
  const showAlerts = !section || section === "alerts";
  const showMuted = !section || section === "muted";
  const showRisk = !section || section === "risk";
  const showTiming = !section || section === "timing";

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

  function setEventChannel(kind: NotificationEventKind, channel: ChannelKey, enabled: boolean) {
    patchEvent(kind, {
      enabled: enabled ? true : preferences.events[kind].enabled,
      [channel]: enabled,
    });
  }

  function patchRisk(
    patch: Partial<NotificationPreferences["positionRiskThresholds"]>
  ) {
    void save({
      ...preferences,
      positionRiskThresholds: {
        ...preferences.positionRiskThresholds,
        ...patch,
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
      {!section && (
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold">Notification preferences</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-otto-text-faint">
            Similar conditions are combined, and the same alert waits for its
            cooldown before notifying again.
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
      )}

      {showAlerts && (
      <section className="space-y-3">
        <div className="flex items-center justify-between rounded-2xl bg-otto-surface px-4 py-3.5">
          <span>
            <span className="block text-sm font-bold">Notifications</span>
            <span className="mt-0.5 block text-[11.5px] text-otto-text-faint">
              Master switch for every channel
            </span>
          </span>
          <Switch
            checked={preferences.masterEnabled}
            label="Enable all notifications"
            onChange={(checked) =>
              void save({ ...preferences, masterEnabled: checked })
            }
          />
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-otto-text-faint">
            1 · Choose a delivery channel
          </div>
          <div className="grid grid-cols-3 gap-2 desk:grid-cols-5">
            {CHANNELS.map((channel) => {
              const count = (Object.keys(EVENT_LABELS) as NotificationEventKind[]).filter(
                (kind) =>
                  preferences.events[kind].enabled &&
                  Boolean(preferences.events[kind][channel.id])
              ).length;
              const selected = selectedChannel === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedChannel(channel.id)}
                  className={`rounded-2xl border px-2 py-3 text-center transition-colors ${
                    selected
                      ? "border-otto-green bg-otto-green-soft text-otto-text"
                      : "border-otto-divider bg-otto-surface text-otto-text-dim"
                  }`}
                >
                  <span className="block text-xs font-bold">{channel.label}</span>
                  <span className="mt-0.5 block text-[9.5px] text-otto-text-faint">
                    {count} type{count === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <ChannelConfiguration
          channel={selectedChannel}
          preferences={preferences}
          save={save}
          test={test}
          testing={testing}
          enableChannelOnLiveAlerts={enableChannelOnLiveAlerts}
          setNotice={setNotice}
        />

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-otto-text-faint">
            2 · Choose alerts for {CHANNELS.find((item) => item.id === selectedChannel)?.label}
          </div>
          <div className="overflow-hidden rounded-2xl bg-otto-surface">
            {(Object.keys(EVENT_LABELS) as NotificationEventKind[]).map((kind, index) => {
              const event = preferences.events[kind];
              const checked = event.enabled && Boolean(event[selectedChannel]);
              return (
                <div key={kind}>
                  {index > 0 && <div className="mx-4 border-t border-otto-divider" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold">{EVENT_LABELS[kind].label}</div>
                      <div className="mt-0.5 text-[10.5px] leading-relaxed text-otto-text-faint">
                        {EVENT_LABELS[kind].description}
                      </div>
                    </div>
                    <Switch
                      checked={checked}
                      label={`${checked ? "Disable" : "Enable"} ${EVENT_LABELS[kind].label} for ${selectedChannel}`}
                      onChange={(next) => setEventChannel(kind, selectedChannel, next)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {showMuted && (
      <section className="rounded-xl bg-otto-surface p-4">
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
      )}

      {showRisk && (
      <div className="space-y-3">
      <section className="rounded-2xl bg-otto-surface p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">Review new trades</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
              Open Risk Analyzer after a manual or screenshot trade is saved.
              The deterministic score uses expiry, earnings, strikes, exposure,
              and available market data.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.riskAnalyzerEnabled}
            onClick={() =>
              void save({
                ...preferences,
                riskAnalyzerEnabled: !preferences.riskAnalyzerEnabled,
              })
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              preferences.riskAnalyzerEnabled ? "bg-otto-green" : "bg-otto-divider"
            }`}
          >
            <span
              className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                preferences.riskAnalyzerEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
          {preferences.riskAnalyzerEnabled ? "On" : "Off by default"}
        </div>
      </section>
      <section className="rounded-2xl bg-otto-surface p-4">
        <h2 className="text-sm font-bold">Position risk rules</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
          These rules drive the Watch, Underwater, and Critical tags on
          Positions and the linked position-risk alerts.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Field label="Critical: ≤ % OTM">
            <input
              type="number"
              min={0}
              max={preferences.positionRiskThresholds.watchStrikeDistancePct}
              step={0.5}
              value={
                preferences.positionRiskThresholds.criticalStrikeDistancePct
              }
              onChange={(event) =>
                patchRisk({
                  criticalStrikeDistancePct: Math.max(
                    0,
                    Math.min(
                      preferences.positionRiskThresholds.watchStrikeDistancePct,
                      Number(event.target.value) || 0
                    )
                  ),
                })
              }
            />
          </Field>
          <Field label="Watch: ≤ % OTM">
            <input
              type="number"
              min={
                preferences.positionRiskThresholds.criticalStrikeDistancePct
              }
              max={100}
              step={0.5}
              value={preferences.positionRiskThresholds.watchStrikeDistancePct}
              onChange={(event) =>
                patchRisk({
                  watchStrikeDistancePct: Math.max(
                    preferences.positionRiskThresholds
                      .criticalStrikeDistancePct,
                    Math.min(100, Number(event.target.value) || 0)
                  ),
                })
              }
            />
          </Field>
          <Field label="Watch slow trade after duration used (%)">
            <input
              type="number"
              min={1}
              max={100}
              value={preferences.positionRiskThresholds.watchTimeUsedPct}
              onChange={(event) =>
                patchRisk({
                  watchTimeUsedPct: Math.min(
                    100,
                    Math.max(1, Number(event.target.value) || 75)
                  ),
                })
              }
            />
          </Field>
          <Field label="Underwater at premium loss (%)">
            <input
              type="number"
              min={1}
              max={500}
              value={
                preferences.positionRiskThresholds.underwaterPremiumLossPct
              }
              onChange={(event) =>
                patchRisk({
                  underwaterPremiumLossPct: Math.min(
                    500,
                    Math.max(1, Number(event.target.value) || 50)
                  ),
                })
              }
            />
          </Field>
        </div>
      </section>
      </div>
      )}

      {showTiming && (
      <section className="rounded-xl bg-otto-surface p-4">
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
          <Field label="Repeat cooldown (hours)">
            <input
              type="number"
              min={1}
              max={168}
              value={preferences.repeatCooldownHours}
              onChange={(event) =>
                void save({
                  ...preferences,
                  repeatCooldownHours: Math.min(
                    168,
                    Math.max(1, Number(event.target.value) || 24)
                  ),
                })
              }
            />
            <div className="mt-1 text-[10px] text-otto-text-faint">
              Critical escalations can still alert separately.
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
      )}

      {(notice || error) && (
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-otto-text-dim">
          {!error && <Check size={14} className="text-otto-green" />}
          {error || notice}
        </div>
      )}
    </div>
  );
}

function ChannelConfiguration({
  channel,
  preferences,
  save,
  test,
  testing,
  enableChannelOnLiveAlerts,
  setNotice,
}: {
  channel: ChannelKey;
  preferences: NotificationPreferences;
  save: (next: NotificationPreferences) => Promise<void>;
  test: (channel: NotificationChannel) => Promise<void>;
  testing: NotificationChannel | null;
  enableChannelOnLiveAlerts: (
    channel: "email" | "discord" | "telegram"
  ) => Promise<void>;
  setNotice: (notice: string) => void;
}) {
  if (channel === "inApp") {
    return (
      <div className="rounded-2xl border border-otto-divider px-4 py-3">
        <div className="text-sm font-bold">In-app inbox</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
          Alerts appear in Otto&apos;s notification screen. No extra setup or
          device permission is required.
        </p>
      </div>
    );
  }

  if (channel === "browser") {
    return (
      <Channel
        title="Browser"
        description="Shows a device notification while Otto is open. Your browser or app must grant permission."
        action={() => void test("browser")}
        configured={
          typeof Notification !== "undefined" && Notification.permission === "granted"
        }
      />
    );
  }

  if (channel === "email") {
    return (
      <Channel
        title="Email"
        description="Delivered privately through Otto's configured SendGrid sender."
        action={() => void test("email")}
        busy={testing === "email"}
        configured={Boolean(preferences.emailAddress)}
        extraAction={{
          label: "Turn on enabled alerts",
          onClick: () => void enableChannelOnLiveAlerts("email"),
        }}
      >
        <Field label="Delivery email">
          <input
            type="email"
            value={preferences.emailAddress}
            onChange={(event) =>
              void save({
                ...preferences,
                emailAddress: event.target.value.trim().toLowerCase(),
              })
            }
            placeholder="you@example.com"
          />
        </Field>
      </Channel>
    );
  }

  if (channel === "discord") {
    return (
      <Channel
        title="Discord"
        description="Paste a channel webhook from Discord → Channel settings → Integrations."
        action={() => void test("discord")}
        busy={testing === "discord"}
        configured={Boolean(preferences.discordWebhook)}
        extraAction={{
          label: "Turn on enabled alerts",
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
    );
  }

  return (
    <Channel
      title="Telegram"
      description="Connect your chat to Otto's shared bot; the bot token remains on the server."
      action={() => void test("telegram")}
      busy={testing === "telegram"}
      configured={Boolean(preferences.telegramChatId)}
      extraAction={{
        label: "Turn on enabled alerts",
        onClick: () => void enableChannelOnLiveAlerts("telegram"),
      }}
    >
      <TelegramSetup preferences={preferences} save={save} notice={setNotice} />
    </Channel>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-otto-green" : "bg-otto-divider"
      }`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
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
