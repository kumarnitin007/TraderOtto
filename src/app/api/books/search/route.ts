import { mapOpenLibraryDocument } from "@/lib/openLibrary";
import { serverSupabaseForRequest } from "@/lib/serverSupabase";

type OpenLibraryResponse = {
  docs?: unknown[];
};

export async function GET(request: Request) {
  const supabase = serverSupabaseForRequest(request);
  if (!supabase) return Response.json({ error: "Sign in to search books." }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to search books." }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200) {
    return Response.json({ error: "Enter a title or author." }, { status: 400 });
  }

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set(
    "fields",
    "key,title,author_name,cover_i,isbn,first_publish_year,number_of_pages_median"
  );
  url.searchParams.set("limit", "8");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 86_400 },
    });
    if (!response.ok) {
      return Response.json({ error: "Open Library search is unavailable." }, { status: 502 });
    }
    const payload = (await response.json()) as OpenLibraryResponse;
    const books = (payload.docs ?? [])
      .map((document) =>
        document && typeof document === "object"
          ? mapOpenLibraryDocument(document as Record<string, unknown>)
          : null
      )
      .filter((book) => book != null);
    return Response.json({ books });
  } catch (cause) {
    const message =
      cause instanceof Error && cause.name === "AbortError"
        ? "Open Library search timed out."
        : "Open Library search failed.";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
