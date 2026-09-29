import type { BooksPreferences, RecommendationRequest } from "@/lib/booksPreferences";

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
  const authors = (request?.authors ?? [])
    .map((author) => author.trim())
    .filter(Boolean)
    .slice(0, 12);
  const criteria = request?.criteria?.trim() || "";
  if (criteria) readerContext.criteria = criteria;

  const assignment = authors.length
    ? "Recommend 3-6 real books by the listed authors that match the criteria and are not in the sample. Spread the list across those authors. Skip an author rather than inventing a weak match."
    : "Recommend 3-6 real books that are not in the sample.";

  return `You are Otto Books, a careful personal reading recommender.

The sample below is the reader's highest and lowest rated books. Infer taste from ratings, tags, series, and reviews.
Reader context outranks the sample. Audience, when given, is a hard suitability limit: never suggest children's books to an adult unless asked.
${assignment} Verify each exact title and author with web search.
Profile: one or two short sentences, no quoting private reviews.
Reason: one sentence under 140 characters tied to this reader, never repeating the title.
Tags: 2-4 short genres per book.
Add "not for you" only for a clear dislike, at most 2 books.
Invent nothing. generatedAt is the current ISO timestamp.

READER: ${JSON.stringify(readerContext)}
AUTHORS: ${JSON.stringify(authors)}
CRITERIA: ${JSON.stringify(criteria || "Best match")}

SAMPLE (${books.length} books): ${JSON.stringify(books.map(compactEntry))}`;
}
