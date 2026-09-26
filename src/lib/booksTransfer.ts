import { bookCoverColor, BUILTIN_SHELVES, shelfSlug } from "@/lib/books";
import type { Book, BookInput, BookJournal, BookShelf } from "@/types/book";
import { EMPTY_BOOK_JOURNAL } from "@/types/book";

export type ParsedBookshelfEntry = {
  title: string;
  author: string;
  shelfName: string;
  rating: number;
  startedAt: string | null;
  finishedAt: string | null;
  review: string;
  tags: string[];
  coverId: number | null;
  favorite: boolean;
  favoriteSpecified: boolean;
  journal: BookJournal;
};

const CSV_HEADERS = [
  "Title",
  "Author",
  "Bookshelf",
  "Bookshelf Type",
  "Rating",
  "Start Date",
  "Finish Date",
  "Description",
  "Favorite Character",
  "Scene Summary",
  "Memorable Moments",
  "Review",
  "Least Favorite Part",
  "Favorite",
  "Genre",
  "Cover URL",
] as const;

export function parseBookshelfFile(text: string): ParsedBookshelfEntry[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  const entries = trimmed.startsWith("[") || trimmed.startsWith("{")
    ? parseJson(trimmed)
    : parseCsvExport(trimmed);
  return entries.filter((entry) => entry.title && entry.author);
}

export function bookshelfExportJson(books: Book[], shelves: BookShelf[]): string {
  return JSON.stringify(books.map((book) => toExportRecord(book, shelves)), null, 2);
}

export function bookshelfExportCsv(books: Book[], shelves: BookShelf[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...books.map((book) => {
      const record = toExportRecord(book, shelves);
      return [
        record.title,
        record.author,
        record.bookshelfName,
        record.bookshelfType,
        record.rating,
        record.startDate ?? "",
        record.finishDate ?? "",
        record.description ?? "",
        record.favoriteCharacter ?? "",
        record.sceneSummary ?? "",
        record.memorableMoments ?? "",
        record.review ?? "",
        record.leastFavoritePart ?? "",
        record.favorite ? "true" : "false",
        record.genre ?? "",
        record.coverUrl ?? "",
      ]
        .map(csvCell)
        .join(",");
    }),
  ];
  return lines.join("\n");
}

export function bookInputFromImport(
  entry: ParsedBookshelfEntry,
  shelves: BookShelf[]
): BookInput {
  const shelf = shelves.find(
    (item) => item.name.trim().toLowerCase() === entry.shelfName.trim().toLowerCase()
  );
  const builtin = BUILTIN_SHELVES.find(
    (item) => item.name.toLowerCase() === entry.shelfName.trim().toLowerCase()
  );
  return {
    title: entry.title,
    author: entry.author,
    status: shelf?.slug ?? builtin?.slug ?? shelfSlug(entry.shelfName || "Read"),
    progressPercent: entry.finishedAt ? 100 : 0,
    rating: entry.rating,
    wouldRecommend: null,
    format: "print",
    pageCount: null,
    durationMinutes: null,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    notes: entry.review,
    tags: entry.tags,
    seriesTitle: "",
    seriesIndex: null,
    isbn: "",
    openLibraryId: "",
    coverId: entry.coverId,
    coverColor: bookCoverColor(entry.title),
    favorite: entry.favorite,
    journal: entry.journal,
  };
}

export function shelfNamesToCreate(entries: ParsedBookshelfEntry[], shelves: BookShelf[]): string[] {
  const known = new Set(shelves.map((shelf) => shelf.name.trim().toLowerCase()));
  const names: string[] = [];
  for (const entry of entries) {
    const name = entry.shelfName.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (known.has(key) || BUILTIN_SHELVES.some((shelf) => shelf.name.toLowerCase() === key)) {
      continue;
    }
    known.add(key);
    names.push(name);
  }
  return names;
}

function parseJson(text: string): ParsedBookshelfEntry[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((row) => {
    const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return fromFields({
      title: textOf(record.title),
      author: textOf(record.author),
      shelfName: textOf(record.bookshelfName ?? record.bookshelf ?? record.shelf),
      bookshelfType: textOf(record.bookshelfType),
      rating: record.rating,
      startDate: textOf(record.startDate),
      finishDate: textOf(record.finishDate),
      description: textOf(record.description),
      favoriteCharacter: textOf(record.favoriteCharacter),
      sceneSummary: textOf(record.sceneSummary),
      memorableMoments: textOf(record.memorableMoments),
      review: textOf(record.review ?? record.notes),
      leastFavoritePart: textOf(record.leastFavoritePart),
      genre: textOf(record.genre),
      coverUrl: textOf(record.coverUrl),
      favorite: record.favorite,
    });
  });
}

function parseCsvExport(text: string): ParsedBookshelfEntry[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const value = (name: string) => row[headers.indexOf(name)] ?? "";
    return fromFields({
      title: value("title"),
      author: value("author"),
      shelfName: value("bookshelf"),
      bookshelfType: value("bookshelf type"),
      rating: value("rating"),
      startDate: value("start date"),
      finishDate: value("finish date"),
      description: value("description"),
      favoriteCharacter: value("favorite character"),
      sceneSummary: value("scene summary"),
      memorableMoments: value("memorable moments"),
      review: value("review"),
      leastFavoritePart: value("least favorite part"),
      genre: value("genre"),
      coverUrl: value("cover url"),
      favorite: value("favorite"),
    });
  });
}

function fromFields(fields: {
  title: string;
  author: string;
  shelfName: string;
  bookshelfType: string;
  rating: unknown;
  startDate: string;
  finishDate: string;
  description: string;
  favoriteCharacter: string;
  sceneSummary: string;
  memorableMoments: string;
  review: string;
  leastFavoritePart: string;
  genre: string;
  coverUrl: string;
  favorite: unknown;
}): ParsedBookshelfEntry {
  const type = fields.bookshelfType.trim().toLowerCase();
  const bookshelfType = type === "wishlist" || type === "regular" ? type : "";
  const shelfName =
    fields.shelfName.trim() || (bookshelfType === "wishlist" ? "Want to read" : "Read");
  const rating = normalizeRating(fields.rating);
  const genre = fields.genre.trim();
  return {
    title: fields.title.trim(),
    author: fields.author.trim() || "Unknown author",
    shelfName,
    rating,
    startedAt: dateOrNull(fields.startDate),
    finishedAt: dateOrNull(fields.finishDate),
    review: fields.review.trim(),
    tags: genre
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    coverId: coverIdFromUrl(fields.coverUrl),
    favorite: fields.favorite === true || String(fields.favorite).trim().toLowerCase() === "true",
    favoriteSpecified:
      fields.favorite === true ||
      ["true", "false"].includes(String(fields.favorite ?? "").trim().toLowerCase()),
    journal: {
      ...EMPTY_BOOK_JOURNAL,
      description: fields.description.trim(),
      favoriteCharacter: fields.favoriteCharacter.trim(),
      sceneSummary: fields.sceneSummary.trim(),
      memorableMoments: fields.memorableMoments.trim(),
      leastFavoritePart: fields.leastFavoritePart.trim(),
      genre,
      bookshelfType,
      coverUrl: fields.coverUrl.trim(),
    },
  };
}

function toExportRecord(book: Book, shelves: BookShelf[]) {
  const shelf = shelves.find((item) => item.slug === book.status);
  const coverUrl =
    book.journal.coverUrl ||
    (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : "");
  return {
    title: book.title,
    author: book.author,
    genre: book.journal.genre || book.tags.join(", "),
    coverUrl,
    description: book.journal.description || null,
    favoriteCharacter: book.journal.favoriteCharacter || null,
    sceneSummary: book.journal.sceneSummary || null,
    memorableMoments: book.journal.memorableMoments || null,
    review: book.notes || null,
    leastFavoritePart: book.journal.leastFavoritePart || null,
    rating: book.rating,
    startDate: book.startedAt,
    finishDate: book.finishedAt,
    bookshelfName: shelf?.name ?? book.status,
    bookshelfType:
      book.journal.bookshelfType || (book.status === "want_to_read" ? "wishlist" : "regular"),
    favorite: book.favorite,
  };
}

function coverIdFromUrl(url: string): number | null {
  const match = url.match(/\/b\/id\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function dateOrNull(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function normalizeRating(value: unknown): number {
  const rating = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(rating)) return 0;
  const stepped = Math.round(Math.min(5, Math.max(0, rating)) * 2) / 2;
  return stepped;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}
