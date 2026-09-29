import { json, openAiJson, preflight, requireUser, safeText } from "../_shared/common.ts";

const recommendation = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    author: { type: "string" },
    reason: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "author", "reason", "tags"],
};
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    generatedAt: { type: "string" },
    profile: { type: "string" },
    recommendations: { type: "array", minItems: 3, maxItems: 6, items: recommendation },
    notForYou: { type: "array", maxItems: 3, items: recommendation },
  },
  required: ["generatedAt", "profile", "recommendations", "notForYou"],
};

function selectBooks<T extends { id: string; rating: number; updated_at: string }>(books: T[]) {
  if (books.length <= 10) return books;
  const rated = books.filter((book) => book.rating > 0).sort(
    (a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at),
  );
  const best = rated.slice(0, 7);
  const used = new Set(best.map((book) => book.id));
  const worst = [...rated].reverse().filter((book) => !used.has(book.id)).slice(0, 3);
  const chosen = [...best, ...worst];
  for (const book of books) {
    if (chosen.length >= 10) break;
    if (!used.has(book.id) && !worst.some((item) => item.id === book.id)) chosen.push(book);
  }
  return chosen;
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const includeIds = Array.isArray(body.includeIds)
    ? body.includeIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  const { data, error } = await auth.client
    .from("bk_books")
    .select("id,title,author,status,rating,would_recommend,tags,series_title,notes,updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return json({ error: error.message }, 500);
  const books = selectBooks(
    (data ?? [])
      .filter((book) => !includeIds || includeIds.includes(book.id))
      .map((book) => ({ ...book, rating: Number(book.rating) })),
  );
  const authors = (Array.isArray(body.request?.authors) ? body.request.authors : [])
    .map((author: unknown) => safeText(author, 80))
    .filter(Boolean)
    .slice(0, 12);
  const criteria = safeText(body.request?.criteria, 40) || "Best selling";
  if (!books.length && !authors.length) {
    return json({ error: "Choose at least one author or book to send." }, 400);
  }

  const context: Record<string, string> = {
    goal: safeText(body.request?.goal, 80) || criteria,
    criteria,
  };
  for (const [key, source, max] of [
    ["audience", body.preferences?.audience, 30],
    ["likes", body.preferences?.likedGenres, 300],
    ["avoid", body.preferences?.avoid, 300],
    ["notes", body.preferences?.readerNotes, 500],
    ["askedFor", body.request?.note, 300],
  ] as const) {
    const value = safeText(source, max);
    if (value) context[key] = value;
  }
  const sample = books.map((book) => {
    const entry: Record<string, unknown> = { title: book.title, author: book.author };
    if (book.rating > 0) entry.rating = book.rating;
    if (book.status !== "read") entry.status = book.status;
    if (book.would_recommend !== null) entry.wouldRecommend = book.would_recommend;
    if (book.series_title) entry.series = book.series_title;
    if (Array.isArray(book.tags) && book.tags.length) entry.tags = book.tags.slice(0, 4);
    if (book.notes?.trim()) entry.review = book.notes.trim().slice(0, 200);
    return entry;
  });
  const assignment = authors.length
    ? "Recommend 3-6 real books by the listed authors that match the criteria and are not in the sample. Spread the list across those authors. Skip an author rather than inventing a weak match."
    : "Recommend 3-6 real books that are not in the sample.";
  const prompt = `You are Otto Books, a careful personal reading recommender.
The sample is the reader's highest and lowest rated books. Reader context outranks it.
${assignment} Verify each exact title and author with web search.
Profile: 1-2 short sentences. Reason: under 140 characters. Tags: 2-4.
Add at most 2 "not for you" books only for a clear dislike. Invent nothing.
READER: ${JSON.stringify(context)}
AUTHORS: ${JSON.stringify(authors)}
CRITERIA: ${JSON.stringify(criteria)}
SAMPLE (${sample.length} books): ${JSON.stringify(sample)}`;
  try {
    const result = await openAiJson(prompt, "book_discovery_report", schema, { webSearch: true });
    return json({
      report: { ...(result.value as object), generatedAt: new Date().toISOString() },
      model: result.model,
      prompt,
      sent: books.map((book) => `${book.title} — ${book.author}`),
    });
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "Book recommendations failed." }, 502);
  }
});
