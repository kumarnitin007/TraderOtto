type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
};

type TelegramUpdate = {
  message?: { text?: string; chat: TelegramChat };
  channel_post?: { text?: string; chat: TelegramChat };
};

export type TelegramBotInfo = {
  username: string;
  name: string;
};

export type MatchedTelegramChat = {
  chatId: string;
  title: string;
  type: string;
};

export function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export async function telegramCall<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const token = telegramToken();
  if (!token) {
    return { ok: false, error: "Telegram bot is not configured on the server." };
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: T;
    description?: string;
  };
  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      error: payload.description || "Telegram rejected the request.",
    };
  }
  return { ok: true, result: payload.result as T };
}

export async function telegramBotInfo(): Promise<
  { ok: true; bot: TelegramBotInfo } | { ok: false; error: string }
> {
  const me = await telegramCall<{ username?: string; first_name?: string }>("getMe");
  if (!me.ok) return me;
  const username =
    process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() ||
    me.result.username ||
    "";
  if (!username) {
    return { ok: false, error: "The Telegram bot does not have a username." };
  }
  return {
    ok: true,
    bot: { username, name: me.result.first_name || "Trader Otto" },
  };
}

export function createTelegramPairCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `OTTO-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export function telegramTextHasCode(text: string | undefined, code: string) {
  if (!text || !code) return false;
  return text.toUpperCase().includes(code.toUpperCase());
}

export async function findChatForPairCode(code: string) {
  const token = telegramToken();
  if (!token) {
    return { ok: false as const, error: "Telegram bot is not configured on the server." };
  }
  const params = new URLSearchParams({
    limit: "100",
    timeout: "0",
    allowed_updates: JSON.stringify(["message", "channel_post"]),
  });
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: TelegramUpdate[];
    description?: string;
  };
  if (!response.ok || !payload.ok || !payload.result) {
    return {
      ok: false as const,
      error: payload.description || "Telegram rejected the request.",
    };
  }
  for (let index = payload.result.length - 1; index >= 0; index -= 1) {
    const update = payload.result[index];
    const entry = update.channel_post ?? update.message;
    if (!entry || !telegramTextHasCode(entry.text, code)) continue;
    return { ok: true as const, chat: summarizeChat(entry.chat) };
  }
  return { ok: false as const, error: "not_found" };
}

function summarizeChat(chat: TelegramChat): MatchedTelegramChat {
  const title =
    chat.title ||
    chat.first_name ||
    (chat.username ? `@${chat.username}` : String(chat.id));
  return { chatId: String(chat.id), title, type: chat.type };
}
