import { serverSupabaseForRequest } from "@/lib/serverSupabase";

const IDENTIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    author: { type: "string" },
    isbn: { type: "string" },
  },
  required: ["title", "author", "isbn"],
} as const;

type OpenAiPayload = {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
  error?: { message?: string };
};

function outputText(payload: OpenAiPayload): string | null {
  if (payload.output_text) return payload.output_text;
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return Response.json({ error: "Sign in to identify a cover." }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to identify a cover." }, { status: 401 });

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return Response.json({ error: "Add OPENAI_API_KEY to .env, then restart the server." }, { status: 500 });

  let image = "";
  try {
    const body = (await request.json()) as { image?: unknown };
    image = typeof body.image === "string" ? body.image : "";
  } catch {
    image = "";
  }
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 6_000_000) {
    return Response.json({ error: "Choose a JPG, PNG, or WebP cover under 4 MB." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Read this book cover. Return the printed title and author. Return the ISBN only when it is visible; otherwise return an empty isbn. Do not guess.",
              },
              { type: "input_image", image_url: image },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "book_cover",
            strict: true,
            schema: IDENTIFY_SCHEMA,
          },
        },
      }),
    });
    const payload = (await response.json()) as OpenAiPayload;
    if (!response.ok) {
      return Response.json(
        { error: payload.error?.message ?? "Could not read this cover." },
        { status: 502 }
      );
    }
    const text = outputText(payload);
    if (!text) return Response.json({ error: "Could not read this cover." }, { status: 502 });
    const parsed = JSON.parse(text) as { title?: string; author?: string; isbn?: string };
    if (!parsed.title?.trim()) {
      return Response.json({ error: "No book title was visible on this image." }, { status: 422 });
    }
    return Response.json({
      title: parsed.title.trim(),
      author: parsed.author?.trim() || "Unknown author",
      isbn: parsed.isbn?.replace(/[^0-9Xx]/g, "").toUpperCase() ?? "",
    });
  } catch (cause) {
    const message =
      cause instanceof Error && cause.name === "AbortError"
        ? "Cover lookup timed out."
        : "Could not read this cover.";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
