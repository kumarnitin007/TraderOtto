import type { BookDiscoveryReport } from "@/types/book";
import type { BooksPreferences, RecommendationRequest } from "@/lib/booksPreferences";

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

/** Drops empty fields and long reviews so the prompt stays small. */
function compactEntry(book: BookPromptEntry) {
  const entry: Record<string, unknown> = {
    title: book.title,
    author: book.author,
  };
  if (book.rating > 0) entry.rating = book.rating;
  if (book.status && book.status !== "read") entry.status = book.status;
  if (book.wouldRecommend !== null) entry.wouldRecommend = book.wouldRecommend;
  if (book.seriesTitle) entry.series = book.seriesTitle;
  if (book.tags.length) entry.tags = book.tags.slice(0, 4);
  const notes = book.notes.trim();
  if (notes) entry.review = notes.length > 200 ? `${notes.slice(0, 200)}…` : notes;
  return entry;
}

export function buildBookDiscoveryPrompt(
  books: BookPromptEntry[],
  preferences?: Partial<BooksPreferences>,
  request?: Partial<RecommendationRequest>
): string {
  const readerContext: Record<string, string> = {
    goal: request?.goal?.trim() || "balanced suggestions",
  };
  if (preferences?.audience) readerContext.audience = preferences.audience;
  if (preferences?.likedGenres?.trim()) readerContext.likes = preferences.likedGenres.trim();
  if (preferences?.avoid?.trim()) readerContext.avoid = preferences.avoid.trim();
  if (preferences?.readerNotes?.trim()) readerContext.notes = preferences.readerNotes.trim();
  if (request?.note?.trim()) readerContext.askedFor = request.note.trim();

  return `You are Otto Books, a careful personal reading recommender.

The sample below is the reader's highest and lowest rated books. Infer taste from ratings, tags, series, and reviews.
Reader context outranks the sample. Audience, when given, is a hard suitability limit: never suggest children's books to an adult unless asked.
Recommend 3-6 real books that are not in the sample. Verify each exact title and author with web search.
Profile: one or two short sentences, no quoting private reviews.
Reason: one sentence under 140 characters tied to this reader, never repeating the title.
Tags: 2-4 short genres per book.
Add "not for you" only for a clear dislike, at most 2 books.
Invent nothing. generatedAt is the current ISO timestamp.

READER: ${JSON.stringify(readerContext)}

SAMPLE (${books.length} books): ${JSON.stringify(books.map(compactEntry))}`;
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

export async function createBookDiscoveryReport(
  books: BookPromptEntry[],
  preferences?: Partial<BooksPreferences>,
  request?: Partial<RecommendationRequest>
) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Add OPENAI_API_KEY to .env, then restart the server.");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const prompt = buildBookDiscoveryPrompt(books, preferences, request);
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
      return { report: parseBookDiscoveryResponse(text), model: payload.model ?? model, prompt };
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
