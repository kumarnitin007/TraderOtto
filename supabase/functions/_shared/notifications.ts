import { env } from "./common.ts";

const kinds = [
  "price_range",
  "position_risk",
  "near_max",
  "expiry_soon",
  "earnings_soon",
  "assignment_cash_high",
];

export function notificationPreferences(value: unknown, email = "") {
  const input = value && typeof value === "object" ? value as Record<string, any> : {};
  const events: Record<string, any> = {};
  for (const kind of kinds) {
    events[kind] = {
      enabled: kind !== "assignment_cash_high",
      inApp: true,
      browser: false,
      email: false,
      discord: false,
      telegram: false,
      ...(input.events?.[kind] ?? {}),
    };
  }
  return {
    masterEnabled: true,
    discordWebhook: "",
    telegramChatId: "",
    telegramPairCode: "",
    telegramPairExpires: "",
    emailAddress: email,
    ...input,
    events,
  };
}

export async function telegram(method: string, body?: Record<string, unknown>) {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false as const, error: "Telegram bot is not configured on the server." };
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return response.ok && payload.ok
    ? { ok: true as const, result: payload.result }
    : { ok: false as const, error: payload.description || "Telegram rejected the request." };
}

export async function botInfo() {
  const me = await telegram("getMe");
  if (!me.ok) return me;
  const username = env("TELEGRAM_BOT_USERNAME").replace(/^@/, "") || me.result.username || "";
  return username
    ? { ok: true as const, bot: { username, name: me.result.first_name || "Trader Otto" } }
    : { ok: false as const, error: "The Telegram bot does not have a username." };
}
