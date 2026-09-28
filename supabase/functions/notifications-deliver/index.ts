import { env, json, preflight, requireUser } from "../_shared/common.ts";
import { notificationPreferences, telegram } from "../_shared/notifications.ts";

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (!["email", "discord", "telegram"].includes(body.channel) ||
      typeof body.title !== "string" || typeof body.message !== "string") {
    return json({ error: "invalid_request" }, 400);
  }
  const { data, error } = await auth.client
    .from("tr_profiles").select("settings").eq("id", auth.user.id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const settings = data?.settings && typeof data.settings === "object" ? data.settings : {};
  const preferences = notificationPreferences(settings.notifications, auth.user.email ?? "");
  const event = preferences.events[body.kind];
  if (!body.test && (!preferences.masterEnabled || !event?.enabled || !event[body.channel])) {
    return json({ skipped: true });
  }
  if (body.channel === "discord") {
    let url: URL;
    try { url = new URL(preferences.discordWebhook); } catch { return json({ error: "Discord webhook is not configured." }, 400); }
    if (!["discord.com", "discordapp.com"].includes(url.hostname) || !url.pathname.startsWith("/api/webhooks/")) {
      return json({ error: "Discord webhook is not configured." }, 400);
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**${body.title}**\n${body.message}` }),
    });
    if (!response.ok) return json({ error: "Discord rejected the message." }, 502);
  }
  if (body.channel === "telegram") {
    if (!preferences.telegramChatId) return json({ error: "Telegram chat is not configured." }, 400);
    const sent = await telegram("sendMessage", {
      chat_id: preferences.telegramChatId,
      text: `${body.title}\n${body.message}`,
    });
    if (!sent.ok) return json({ error: sent.error }, 502);
  }
  if (body.channel === "email") {
    const key = env("SENDGRID_API_KEY");
    const from = env("NOTIFICATION_FROM_EMAIL");
    if (!key || !from || !preferences.emailAddress) {
      return json({ error: "Email delivery is not configured on the server." }, 400);
    }
    const match = from.match(/^(.*?)\s*<([^>]+)>$/);
    const sender = match?.[2]
      ? { name: match[1].trim() || "Trader Otto", email: match[2].trim() }
      : { name: "Trader Otto", email: from };
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: preferences.emailAddress }] }],
        from: sender,
        subject: body.title,
        content: [{ type: "text/plain", value: body.message }],
      }),
    });
    if (!response.ok) return json({ error: "SendGrid rejected the message." }, 502);
  }
  return json({ ok: true });
});
