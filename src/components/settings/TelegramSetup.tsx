"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NotificationPreferences } from "@/types/notification";

type BotInfo = { username: string; name: string };

export function TelegramSetup({
  preferences,
  save,
  notice,
}: {
  preferences: NotificationPreferences;
  save: (next: NotificationPreferences) => Promise<void>;
  notice: (message: string) => void;
}) {
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [code, setCode] = useState(preferences.telegramPairCode);
  const [startUrl, setStartUrl] = useState("");
  const [busy, setBusy] = useState<"pair" | "find" | null>(null);
  const [showChannel, setShowChannel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const payload = await telegramFetch("GET");
      if (cancelled) return;
      setServerReady(Boolean(payload.configured));
      if (payload.bot) setBot(payload.bot);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCode(preferences.telegramPairCode);
  }, [preferences.telegramPairCode]);

  async function startPair() {
    setBusy("pair");
    try {
      const payload = await telegramFetch("POST", { action: "start_pair" });
      if (payload.error || !payload.code) {
        notice(payload.error || "Could not start Telegram pairing.");
        return;
      }
      setCode(payload.code);
      setStartUrl(payload.startUrl || "");
      if (payload.bot) setBot(payload.bot);
      await save({
        ...preferences,
        telegramPairCode: payload.code,
        telegramPairExpires: payload.expiresAt || "",
      });
      notice("Pairing code ready. Open the bot, then tap Find my chat.");
    } finally {
      setBusy(null);
    }
  }

  async function findChat() {
    setBusy("find");
    try {
      const payload = await telegramFetch("POST", { action: "complete_pair" });
      if (payload.error || !payload.chat) {
        notice(payload.error || "Could not find your Telegram chat.");
        return;
      }
      await save({
        ...preferences,
        telegramChatId: payload.chat.chatId,
        telegramPairCode: "",
        telegramPairExpires: "",
      });
      setCode("");
      notice(`Connected to ${payload.chat.title}. Send a Test message next.`);
    } finally {
      setBusy(null);
    }
  }

  const botLink = bot ? `https://t.me/${bot.username}` : "";
  const openUrl = startUrl || (code && bot ? `${botLink}?start=${code}` : botLink);

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-relaxed text-otto-text-faint">
        You do not create your own bot. Otto uses one shared bot. A private chat
        with that bot is enough — a Telegram channel is optional.
      </p>
      {serverReady === false && (
        <p className="text-[11.5px] text-otto-amber">
          Telegram is not enabled on this deployment yet. The bot token is a
          server setting, not something you paste here.
        </p>
      )}

      <ol className="list-decimal space-y-1.5 pl-4 text-[11.5px] leading-relaxed text-otto-text-dim">
        <li>
          Tap <span className="font-semibold">Get pairing code</span>.
        </li>
        <li>
          Open {bot ? `@${bot.username}` : "the Trader Otto bot"} and tap Start
          (or send the code).
        </li>
        <li>
          Return here and tap <span className="font-semibold">Find my chat</span>.
          Otto fills the chat ID.
        </li>
        <li>
          Send a Test, then tap <span className="font-semibold">Use for live alerts</span>.
        </li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void startPair()}
          disabled={busy !== null || serverReady === false}
          className="rounded-full border border-otto-divider px-3 py-1.5 text-[11px] font-semibold text-otto-text-dim disabled:opacity-50"
        >
          {busy === "pair" ? "Preparing…" : "Get pairing code"}
        </button>
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-otto-divider px-3 py-1.5 text-[11px] font-semibold text-otto-text-dim"
          >
            Open bot
            <ExternalLink size={11} />
          </a>
        )}
        <button
          type="button"
          onClick={() => void findChat()}
          disabled={busy !== null || !code}
          className="rounded-full border border-otto-divider px-3 py-1.5 text-[11px] font-semibold text-otto-text-dim disabled:opacity-50"
        >
          {busy === "find" ? "Looking…" : "Find my chat"}
        </button>
      </div>

      {code && (
        <div className="rounded-xl bg-otto-bg px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
            Pairing code
          </div>
          <div className="mt-1 font-mono text-sm font-bold tracking-wide">{code}</div>
          <div className="mt-1 text-[10.5px] text-otto-text-faint">
            Valid about 15 minutes. If Start did not send it, type this code to the bot.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowChannel((open) => !open)}
        className="text-[11px] font-semibold text-otto-text-dim"
      >
        {showChannel ? "Hide channel / group steps" : "I want a channel or group instead"}
      </button>
      {showChannel && (
        <ol className="list-decimal space-y-1.5 pl-4 text-[11.5px] leading-relaxed text-otto-text-dim">
          <li>Create a channel or group, or open one you already own.</li>
          <li>
            Add {bot ? `@${bot.username}` : "the Trader Otto bot"} as a member.
          </li>
          <li>
            For a <span className="font-semibold">channel</span>, open Administrators
            and make the bot an admin with <span className="font-semibold">Post messages</span>
            turned on. Groups only need the bot as a member, then anyone can @mention it.
          </li>
          <li>
            Get a pairing code above, post that exact code in the channel/group, then tap
            Find my chat.
          </li>
        </ol>
      )}

      <label className="block text-[11px] font-medium text-otto-text-faint">
        Chat ID
        <input
          value={preferences.telegramChatId}
          onChange={(event) =>
            void save({ ...preferences, telegramChatId: event.target.value.trim() })
          }
          placeholder="-1001234567890"
        />
      </label>
      <p className="text-[10.5px] text-otto-text-faint">
        Private chats are usually a positive number. Channels and groups often start with
        -100. You can paste an ID manually if you already have one.
      </p>
    </div>
  );
}

async function telegramFetch(method: "GET" | "POST", body?: Record<string, string>) {
  const supabase = getSupabaseClient();
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const response = await fetch("/api/notifications/telegram", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  return (await response.json()) as {
    configured?: boolean;
    bot?: BotInfo | null;
    code?: string;
    expiresAt?: string;
    startUrl?: string;
    chat?: { chatId: string; title: string; type: string };
    error?: string;
  };
}
