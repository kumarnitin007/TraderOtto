import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(request: Request) {
  return request.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders })
    : null;
}

export function env(name: string, fallback = "") {
  return Deno.env.get(name)?.trim() || fallback;
}

export function userClient(request: Request): SupabaseClient | null {
  const authorization = request.headers.get("Authorization");
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY");
  if (!authorization || !url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(request: Request): Promise<
  | { ok: true; client: SupabaseClient; user: User }
  | { ok: false; response: Response }
> {
  const client = userClient(request);
  if (!client) return { ok: false, response: json({ error: "unauthorized" }, 401) };
  const {
    data: { user },
  } = await client.auth.getUser();
  return user
    ? { ok: true, client, user }
    : { ok: false, response: json({ error: "unauthorized" }, 401) };
}

export async function optionalUser(request: Request) {
  const client = userClient(request);
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? { client, user } : null;
}

export function alpaca() {
  const key = env("ALPACA_API_KEY_ID");
  const secret = env("ALPACA_API_SECRET_KEY");
  return {
    key,
    secret,
    configured: Boolean(key && secret),
    dataUrl: env("ALPACA_DATA_URL", "https://data.alpaca.markets"),
    tradingUrl: env("ALPACA_TRADING_URL", "https://paper-api.alpaca.markets"),
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
    },
  };
}

export function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function openAiOutput(payload: {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
}) {
  if (payload.output_text) return payload.output_text;
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export async function openAiJson(
  prompt: string,
  name: string,
  schema: Record<string, unknown>,
  options?: { image?: string; webSearch?: boolean; timeout?: number }
) {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  const content: Record<string, unknown>[] = [{ type: "input_text", text: prompt }];
  if (options?.image) content.push({ type: "input_image", image_url: options.image });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeout ?? 55_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: env("OPENAI_MODEL", "gpt-4o-mini"),
        input: [{ role: "user", content }],
        ...(options?.webSearch ? { tools: [{ type: "web_search_preview" }] } : {}),
        text: { format: { type: "json_schema", name, strict: true, schema } },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? "OpenAI request failed.");
    const text = openAiOutput(payload);
    if (!text) throw new Error("OpenAI returned no structured output.");
    return {
      value: JSON.parse(text),
      model: payload.model ?? env("OPENAI_MODEL", "gpt-4o-mini"),
      tokensIn: payload.usage?.input_tokens ?? null,
      tokensOut: payload.usage?.output_tokens ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function openAiObject(prompt: string, webSearch = true) {
  const key = env("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("OPENAI_MODEL", "gpt-4o-mini"),
      input: prompt,
      ...(webSearch ? { tools: [{ type: "web_search_preview" }] } : {}),
      text: { format: { type: "json_object" } },
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "OpenAI request failed.");
  const text = openAiOutput(payload);
  if (!text) throw new Error("OpenAI returned no report.");
  return {
    value: JSON.parse(text),
    model: payload.model ?? env("OPENAI_MODEL", "gpt-4o-mini"),
    tokensIn: payload.usage?.input_tokens ?? null,
    tokensOut: payload.usage?.output_tokens ?? null,
  };
}
