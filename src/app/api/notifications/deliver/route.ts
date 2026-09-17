import { mergeNotificationPreferences } from "@/lib/notificationDefaults";
import { resendFromAddress, sendResendEmail } from "@/lib/resendMail";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";
import { telegramCall, telegramToken } from "@/lib/telegram";
import type {
  NotificationChannel,
  NotificationEventKind,
} from "@/types/notification";

type DeliveryBody = {
  channel: NotificationChannel;
  kind: NotificationEventKind;
  title: string;
  message: string;
  test?: boolean;
};

function validDiscordWebhook(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "discord.com" || url.hostname === "discordapp.com") &&
      url.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return Response.json({ error: "unauthorized" }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as DeliveryBody;
  if (
    !["email", "discord", "telegram"].includes(body.channel) ||
    typeof body.title !== "string" ||
    typeof body.message !== "string"
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: profile, error } = await supabase
    .from("tr_profiles")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const settings =
    profile?.settings && typeof profile.settings === "object"
      ? (profile.settings as Record<string, unknown>)
      : {};
  const preferences = mergeNotificationPreferences(
    settings.notifications,
    user.email ?? ""
  );
  const event = preferences.events[body.kind];
  if (!body.test && (!preferences.masterEnabled || !event?.enabled || !event[body.channel])) {
    return Response.json({ skipped: true });
  }

  const content = `**${body.title}**\n${body.message}`;
  if (body.channel === "discord") {
    if (!validDiscordWebhook(preferences.discordWebhook)) {
      return Response.json({ error: "Discord webhook is not configured." }, { status: 400 });
    }
    const response = await fetch(preferences.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      return Response.json({ error: "Discord rejected the message." }, { status: 502 });
    }
  }

  if (body.channel === "telegram") {
    if (!telegramToken() || !preferences.telegramChatId) {
      return Response.json(
        { error: "Telegram bot token or chat ID is not configured." },
        { status: 400 }
      );
    }
    const sent = await telegramCall("sendMessage", {
      chat_id: preferences.telegramChatId,
      text: `${body.title}\n${body.message}`,
    });
    if (!sent.ok) {
      return Response.json({ error: sent.error }, { status: 502 });
    }
  }

  if (body.channel === "email") {
    const from = resendFromAddress();
    if (!preferences.emailAddress) {
      return Response.json(
        { error: "Email delivery is not configured on the server." },
        { status: 400 }
      );
    }
    const sent = await sendResendEmail({
      from,
      to: preferences.emailAddress,
      subject: body.title,
      text: body.message,
    });
    if (!sent.ok) {
      return Response.json({ error: sent.error }, { status: 502 });
    }
  }

  return Response.json({ ok: true });
}
