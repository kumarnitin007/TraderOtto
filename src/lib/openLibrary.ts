import type { OpenLibraryBook } from "@/types/book";

type OpenLibraryDocument = {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  cover_i?: unknown;
  isbn?: unknown;
  first_publish_year?: unknown;
  number_of_pages_median?: unknown;
};

export function openLibraryCoverUrl(
  coverId: number | null,
  size: "S" | "M" | "L" = "M"
): string | null {
  return coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`
    : null;
}

export function mapOpenLibraryDocument(document: OpenLibraryDocument): OpenLibraryBook | null {
  if (typeof document.title !== "string" || !document.title.trim()) return null;
  const authors = Array.isArray(document.author_name)
    ? document.author_name.filter((author): author is string => typeof author === "string")
    : [];
  const isbns = Array.isArray(document.isbn)
    ? document.isbn.filter((isbn): isbn is string => typeof isbn === "string")
    : [];
  const key = typeof document.key === "string" ? document.key : "";
  return {
    title: document.title.trim(),
    author: authors[0]?.trim() || "Unknown author",
    isbn: isbns.find((isbn) => isbn.length === 13) ?? isbns[0] ?? "",
    openLibraryId: key.replace(/^\/works\//, ""),
    coverId: typeof document.cover_i === "number" ? document.cover_i : null,
    pageCount:
      typeof document.number_of_pages_median === "number"
        ? Math.round(document.number_of_pages_median)
        : null,
    firstPublishYear:
      typeof document.first_publish_year === "number" ? document.first_publish_year : null,
  };
}
