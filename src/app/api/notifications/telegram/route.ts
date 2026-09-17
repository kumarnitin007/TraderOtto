import { mergeNotificationPreferences } from "@/lib/notificationDefaults";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";
import {
  createTelegramPairCode,
  findChatForPairCode,
  telegramBotInfo,
  telegramToken,
} from "@/lib/telegram";
import type { NotificationPreferences } from "@/types/notification";

const PAIR_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user.ok) return user.response;
  if (!telegramToken()) {
    return Response.json({ configured: false, bot: null });
  }
  const bot = await telegramBotInfo();
  if (!bot.ok) {
    return Response.json({ configured: false, bot: null, error: bot.error });
  }
  return Response.json({ configured: true, bot: bot.bot });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user.ok) return user.response;
  if (!telegramToken()) {
    return Response.json(
      { error: "Telegram bot is not configured on the server." },
      { status: 400 }
    );
  }

  const body = (await request.json()) as { action?: string };
  if (body.action === "start_pair") {
    const bot = await telegramBotInfo();
    if (!bot.ok) return Response.json({ error: bot.error }, { status: 400 });
    const code = createTelegramPairCode();
    const expiresAt = new Date(Date.now() + PAIR_MS).toISOString();
    const saved = await patchNotifications(user.supabase, user.id, user.email, {
      telegramPairCode: code,
      telegramPairExpires: expiresAt,
    });
    if (!saved.ok) return Response.json({ error: saved.error }, { status: 500 });
    return Response.json({
      code,
      expiresAt,
      bot: bot.bot,
      startUrl: `https://t.me/${bot.bot.username}?start=${code}`,
    });
  }

  if (body.action === "complete_pair") {
    const current = await loadNotifications(user.supabase, user.id, user.email);
    if (!current.ok) return Response.json({ error: current.error }, { status: 500 });
    const code = current.preferences.telegramPairCode;
    const expiresAt = current.preferences.telegramPairExpires;
    if (!code || !expiresAt || Date.parse(expiresAt) < Date.now()) {
      return Response.json(
        { error: "Start pairing again, then message the bot with the new code." },
        { status: 400 }
      );
    }
    const match = await findChatForPairCode(code);
    if (!match.ok) {
      return Response.json(
        {
          error:
            match.error === "not_found"
              ? "Otto has not seen that code yet. Open the bot, send Start (or post the code in your channel), then try again."
              : match.error,
        },
        { status: 400 }
      );
    }
    const saved = await patchNotifications(user.supabase, user.id, user.email, {
      telegramChatId: match.chat.chatId,
      telegramPairCode: "",
      telegramPairExpires: "",
    });
    if (!saved.ok) return Response.json({ error: saved.error }, { status: 500 });
    return Response.json({ chat: match.chat });
  }

  return Response.json({ error: "invalid_request" }, { status: 400 });
}

async function requireUser(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) {
    return { ok: false as const, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, supabase, id: user.id, email: user.email ?? "" };
}

async function loadNotifications(
  supabase: NonNullable<ReturnType<typeof serverSupabaseForRequest>>,
  userId: string,
  email: string
) {
  const { data, error } = await supabase
    .from("tr_profiles")
    .select("settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  const settings =
    data?.settings && typeof data.settings === "object"
      ? (data.settings as Record<string, unknown>)
      : {};
  return {
    ok: true as const,
    settings,
    preferences: mergeNotificationPreferences(settings.notifications, email),
  };
}

async function patchNotifications(
  supabase: NonNullable<ReturnType<typeof serverSupabaseForRequest>>,
  userId: string,
  email: string,
  patch: Partial<NotificationPreferences>
) {
  const current = await loadNotifications(supabase, userId, email);
  if (!current.ok) return current;
  const preferences = { ...current.preferences, ...patch };
  const { error } = await supabase.from("tr_profiles").upsert({
    id: userId,
    settings: { ...current.settings, notifications: preferences },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, preferences };
}
