import { createBookDiscoveryReport, type BookPromptEntry } from "@/lib/booksAiServer";
import type { BooksPreferences, RecommendationRequest } from "@/lib/booksPreferences";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";

type BookRow = {
  title: string;
  author: string;
  status: string;
  rating: number;
  would_recommend: boolean | null;
  tags: unknown;
  series_title: string | null;
  notes: string | null;
};

export async function POST(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return Response.json({ error: "Sign in to use Discover." }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to use Discover." }, { status: 401 });

  let includeIds: string[] | null = null;
  let preferences: Partial<BooksPreferences> = {};
  let recommendationRequest: Partial<RecommendationRequest> = {};
  try {
    const body = (await request.json()) as {
      includeIds?: unknown;
      preferences?: unknown;
      request?: unknown;
    };
    if (Array.isArray(body.includeIds)) {
      includeIds = body.includeIds.filter((id): id is string => typeof id === "string");
    }
    if (body.preferences && typeof body.preferences === "object") {
      const value = body.preferences as Record<string, unknown>;
      preferences = {
        audience: safeText(value.audience, 30) as BooksPreferences["audience"],
        likedGenres: safeText(value.likedGenres, 300),
        avoid: safeText(value.avoid, 300),
        readerNotes: safeText(value.readerNotes, 500),
      };
    }
    if (body.request && typeof body.request === "object") {
      const value = body.request as Record<string, unknown>;
      recommendationRequest = {
        goal: safeText(value.goal, 80),
        note: safeText(value.note, 300),
      };
    }
  } catch {
    includeIds = null;
  }

  const { data, error } = await supabase
    .from("bk_books")
    .select("id, title, author, status, rating, would_recommend, tags, series_title, notes")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = ((data ?? []) as (BookRow & { id: string })[]).filter(
    (book) => !includeIds || includeIds.includes(book.id)
  );
  if (!rows.length) {
    return Response.json(
      {
        error: includeIds
          ? "Choose at least one book to send."
          : "Add and rate at least one book first.",
      },
      { status: 400 }
    );
  }

  const books: BookPromptEntry[] = rows.map((book) => ({
    title: book.title,
    author: book.author,
    status: book.status,
    rating: Number(book.rating),
    wouldRecommend: book.would_recommend,
    tags: Array.isArray(book.tags)
      ? book.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    seriesTitle: book.series_title,
    notes: (book.notes ?? "").slice(0, 800),
  }));

  try {
    const result = await createBookDiscoveryReport(
      books,
      preferences,
      recommendationRequest
    );
    return Response.json({
      report: { ...result.report, generatedAt: new Date().toISOString() },
      model: result.model,
    });
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Book recommendations failed." },
      { status: 502 }
    );
  }
}

function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
