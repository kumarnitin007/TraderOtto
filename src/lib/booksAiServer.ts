import type { BookDiscoveryReport } from "@/types/book";

const recommendationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    author: { type: "string" },
    reason: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "author", "reason", "tags"],
} as const;

const BOOK_DISCOVERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    generatedAt: { type: "string" },
    profile: { type: "string" },
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: recommendationSchema,
    },
    notForYou: {
      type: "array",
      maxItems: 3,
      items: recommendationSchema,
    },
  },
  required: ["generatedAt", "profile", "recommendations", "notForYou"],
} as const;

type OpenAiPayload = {
  model?: string;
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
  error?: { message?: string };
};

export type BookPromptEntry = {
  title: string;
  author: string;
  status: string;
  rating: number;
  wouldRecommend: boolean | null;
  tags: string[];
  seriesTitle: string | null;
  notes: string;
};

export function buildBookDiscoveryPrompt(books: BookPromptEntry[]): string {
  return `You are Otto Books, a careful personal reading recommender.

Use the reader's actual library below to infer taste from ratings, recommendation flags, tags, series, status, and notes.
Recommend 3-6 real books that are not already in the library. Use web search to verify each exact title and author.
Give a concise, specific reason tied to evidence in this reader's library. Do not invent books, authors, series, or claims.
Also provide up to 3 real "not for you" examples only when the library shows a clear negative preference.
The profile must summarize preferences without exposing or quoting private notes verbatim.
generatedAt must be the current ISO timestamp.

LIBRARY:
${JSON.stringify(books.slice(0, 100))}`;
}

function outputText(payload: OpenAiPayload): string | null {
  if (payload.output_text) return payload.output_text;
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export function parseBookDiscoveryResponse(text: string): BookDiscoveryReport {
  const candidate = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI returned no recommendation report.");
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as BookDiscoveryReport;
  if (
    typeof parsed.profile !== "string" ||
    !Array.isArray(parsed.recommendations) ||
    !Array.isArray(parsed.notForYou)
  ) {
    throw new Error("AI returned an invalid recommendation report.");
  }
  return parsed;
}

export async function createBookDiscoveryReport(books: BookPromptEntry[]) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Add OPENAI_API_KEY to .env, then restart the server.");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const prompt = buildBookDiscoveryPrompt(books);
  const base = {
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "book_discovery_report",
        strict: true,
        schema: BOOK_DISCOVERY_SCHEMA,
      },
    },
  };
  const attempts = [{ ...base, tools: [{ type: "web_search" }] }, base];
  let lastError: Error | null = null;

  for (const body of attempts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, ...body }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as OpenAiPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? `OpenAI failed (${response.status}).`);
      }
      const text = outputText(payload);
      if (!text) throw new Error("AI returned no recommendation report.");
      return { report: parseBookDiscoveryResponse(text), model: payload.model ?? model };
    } catch (cause) {
      lastError =
        cause instanceof Error && cause.name === "AbortError"
          ? new Error("Book recommendations timed out. Try again.")
          : cause instanceof Error
            ? cause
            : new Error("Book recommendations failed.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("Book recommendations failed.");
}
