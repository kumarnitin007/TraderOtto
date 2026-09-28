import { env, json, preflight, requireUser } from "../_shared/common.ts";
import { botInfo, notificationPreferences } from "../_shared/notifications.ts";

const PAIR_MS = 15 * 60 * 1000;

function pairCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `OTTO-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!env("TELEGRAM_BOT_TOKEN")) return json({ configured: false, bot: null }, request.method === "GET" ? 200 : 400);
  const bot = await botInfo();
  if (request.method === "GET") {
    return bot.ok ? json({ configured: true, bot: bot.bot }) : json({ configured: false, bot: null, error: bot.error });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await request.json().catch(() => ({}));
  const { data, error } = await auth.client
    .from("tr_profiles").select("settings").eq("id", auth.user.id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const settings = data?.settings && typeof data.settings === "object" ? data.settings : {};
  const preferences = notificationPreferences(settings.notifications, auth.user.email ?? "");
  if (body.action === "start_pair") {
    if (!bot.ok) return json({ error: bot.error }, 400);
    preferences.telegramPairCode = pairCode();
    preferences.telegramPairExpires = new Date(Date.now() + PAIR_MS).toISOString();
    const saved = await auth.client.from("tr_profiles").upsert({
      id: auth.user.id,
      settings: { ...settings, notifications: preferences },
    });
    if (saved.error) return json({ error: saved.error.message }, 500);
    return json({
      code: preferences.telegramPairCode,
      expiresAt: preferences.telegramPairExpires,
      bot: bot.bot,
      startUrl: `https://t.me/${bot.bot.username}?start=${preferences.telegramPairCode}`,
    });
  }
  if (body.action === "complete_pair") {
    if (!preferences.telegramPairCode ||
        !preferences.telegramPairExpires ||
        Date.parse(preferences.telegramPairExpires) < Date.now()) {
      return json({ error: "Start pairing again, then message the bot with the new code." }, 400);
    }
    const token = env("TELEGRAM_BOT_TOKEN");
    const params = new URLSearchParams({
      limit: "100",
      timeout: "0",
      allowed_updates: JSON.stringify(["message", "channel_post"]),
    });
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params}`);
    const payload = await response.json();
    const code = preferences.telegramPairCode.toUpperCase();
    const update = [...(payload.result ?? [])].reverse().find((item: any) => {
      const entry = item.channel_post ?? item.message;
      return entry?.text?.toUpperCase().includes(code);
    });
    const entry = update?.channel_post ?? update?.message;
    if (!entry) return json({ error: "Otto has not seen that code yet." }, 400);
    preferences.telegramChatId = String(entry.chat.id);
    preferences.telegramPairCode = "";
    preferences.telegramPairExpires = "";
    const saved = await auth.client.from("tr_profiles").upsert({
      id: auth.user.id,
      settings: { ...settings, notifications: preferences },
    });
    if (saved.error) return json({ error: saved.error.message }, 500);
    return json({
      chat: {
        chatId: preferences.telegramChatId,
        title: entry.chat.title || entry.chat.first_name || entry.chat.username || String(entry.chat.id),
        type: entry.chat.type,
      },
    });
  }
  return json({ error: "invalid_request" }, 400);
});
