import { json, preflight, requireUser } from "../_shared/common.ts";

const noise = /accessible book|protected daisy|in library|lending library|open library staff/i;

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isIsbn(value: string) {
  return /^\d{9}[\dX]$|^\d{13}$/.test(normalizeIsbn(value));
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200) {
    return json({ error: "Enter a title, author, or ISBN." }, 400);
  }
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set(isIsbn(query) ? "isbn" : "q", isIsbn(query) ? normalizeIsbn(query) : query);
  url.searchParams.set(
    "fields",
    "key,title,author_name,cover_i,isbn,first_publish_year,number_of_pages_median,subject",
  );
  url.searchParams.set("limit", "8");
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return json({ error: "Open Library search is unavailable." }, 502);
    const payload = await response.json();
    const books = (payload.docs ?? []).flatMap((doc: Record<string, unknown>) => {
      if (typeof doc.title !== "string" || !doc.title.trim()) return [];
      const authors = Array.isArray(doc.author_name)
        ? doc.author_name.filter((item): item is string => typeof item === "string")
        : [];
      const isbns = Array.isArray(doc.isbn)
        ? doc.isbn.filter((item): item is string => typeof item === "string")
        : [];
      const subjects: string[] = [];
      for (const item of Array.isArray(doc.subject) ? doc.subject : []) {
        if (typeof item !== "string") continue;
        const value = item.trim().toLowerCase();
        if (value.length < 3 || value.length > 28 || noise.test(value) || subjects.includes(value)) continue;
        subjects.push(value);
        if (subjects.length === 6) break;
      }
      return [{
        title: doc.title.trim(),
        author: authors[0]?.trim() || "Unknown author",
        isbn: isbns.find((isbn) => isbn.length === 13) ?? isbns[0] ?? "",
        openLibraryId: typeof doc.key === "string" ? doc.key.replace(/^\/works\//, "") : "",
        coverId: typeof doc.cover_i === "number" ? doc.cover_i : null,
        pageCount:
          typeof doc.number_of_pages_median === "number"
            ? Math.round(doc.number_of_pages_median)
            : null,
        firstPublishYear:
          typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
        subjects,
      }];
    });
    return json({ books });
  } catch {
    return json({ error: "Open Library search failed." }, 502);
  }
});
