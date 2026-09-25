import { createBookDiscoveryReport, type BookPromptEntry } from "@/lib/booksAiServer";
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

  const { data, error } = await supabase
    .from("bk_books")
    .select("title, author, status, rating, would_recommend, tags, series_title, notes")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as BookRow[];
  if (!rows.length) {
    return Response.json({ error: "Add and rate at least one book first." }, { status: 400 });
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
    const result = await createBookDiscoveryReport(books);
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
