export type ReaderAudience = "" | "adult" | "young_adult" | "teen" | "child";

export type BookCatalog = {
  id: string;
  name: string;
  searchUrl: string;
};

export type BooksPreferences = {
  audience: ReaderAudience;
  likedGenres: string;
  avoid: string;
  readerNotes: string;
  catalogs: BookCatalog[];
};

export type RecommendationRequest = {
  goal: string;
  note: string;
};

export const BOOKS_PREFERENCES_KEY = "trader-otto:books-preferences";

export const DEFAULT_BOOKS_PREFERENCES: BooksPreferences = {
  audience: "",
  likedGenres: "",
  avoid: "",
  readerNotes: "",
  catalogs: [],
};

export const KNOWN_BOOK_CATALOGS: BookCatalog[] = [
  {
    id: "king-county",
    name: "King County Library System",
    searchUrl: "https://kcls.bibliocommons.com/v2/search?query={query}&searchType=smart",
  },
  {
    id: "sno-isle",
    name: "Sno-Isle Libraries",
    searchUrl: "https://sno-isle.bibliocommons.com/v2/search?query={query}&searchType=smart",
  },
];

export function readBooksPreferences(): BooksPreferences {
  if (typeof window === "undefined") return DEFAULT_BOOKS_PREFERENCES;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(BOOKS_PREFERENCES_KEY) ?? "{}"
    ) as Partial<BooksPreferences>;
    return {
      audience: isAudience(parsed.audience) ? parsed.audience : "",
      likedGenres: text(parsed.likedGenres, 300),
      avoid: text(parsed.avoid, 300),
      readerNotes: text(parsed.readerNotes, 500),
      catalogs: Array.isArray(parsed.catalogs)
        ? parsed.catalogs
            .filter(isCatalog)
            .slice(0, 3)
            .map((catalog) => ({
              id: catalog.id.slice(0, 80),
              name: catalog.name.slice(0, 80),
              searchUrl: catalog.searchUrl.slice(0, 500),
            }))
        : [],
    };
  } catch {
    return DEFAULT_BOOKS_PREFERENCES;
  }
}

export function writeBooksPreferences(preferences: BooksPreferences): void {
  window.localStorage.setItem(BOOKS_PREFERENCES_KEY, JSON.stringify(preferences));
}

export function catalogSearchUrl(catalog: BookCatalog, title: string, author: string): string {
  const query = encodeURIComponent(`${title} ${author}`.trim());
  return catalog.searchUrl.includes("{query}")
    ? catalog.searchUrl.replaceAll("{query}", query)
    : `${catalog.searchUrl}${catalog.searchUrl.includes("?") ? "&" : "?"}query=${query}`;
}

function isAudience(value: unknown): value is ReaderAudience {
  return (
    value === "" ||
    value === "adult" ||
    value === "young_adult" ||
    value === "teen" ||
    value === "child"
  );
}

function isCatalog(value: unknown): value is BookCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<BookCatalog>;
  return (
    typeof catalog.id === "string" &&
    typeof catalog.name === "string" &&
    typeof catalog.searchUrl === "string" &&
    /^https?:\/\//i.test(catalog.searchUrl)
  );
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
