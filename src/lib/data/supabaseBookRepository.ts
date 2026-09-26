import type { SupabaseClient } from "@supabase/supabase-js";
import { shelfSlug } from "@/lib/books";
import type { BookRepository } from "@/lib/bookRepository";
import type {
  Book,
  BookDiscoveryReport,
  BookFormat,
  BookInput,
  BookJournal,
  BookShelf,
  StoredBookDiscoveryReport,
} from "@/types/book";

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  status: string;
  progress_percent: number;
  rating: number;
  would_recommend: boolean | null;
  format: BookFormat;
  page_count: number | null;
  duration_minutes: number | null;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
  tags: unknown;
  series_title: string | null;
  series_index: number | null;
  isbn: string | null;
  open_library_id: string | null;
  cover_id: number | null;
  cover_color: string;
  meta?: unknown;
  created_at: string;
  updated_at: string;
};

type DiscoveryRow = {
  id: string;
  report: unknown;
  model: string;
  created_at: string;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function mapBookRow(row: BookRow): Book {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    author: row.author,
    status: row.status,
    progressPercent: Number(row.progress_percent),
    rating: Number(row.rating),
    wouldRecommend: row.would_recommend,
    format: row.format,
    pageCount: row.page_count == null ? null : Number(row.page_count),
    durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    notes: row.notes ?? "",
    tags: stringArray(row.tags),
    seriesTitle: row.series_title ?? "",
    seriesIndex: row.series_index == null ? null : Number(row.series_index),
    isbn: row.isbn ?? "",
    openLibraryId: row.open_library_id ?? "",
    coverId: row.cover_id == null ? null : Number(row.cover_id),
    coverColor: row.cover_color,
    favorite: readBookMeta(row.meta).favorite,
    journal: readBookMeta(row.meta).journal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bookPayload(input: BookInput) {
  return {
    title: input.title.trim(),
    author: input.author.trim(),
    status: input.status,
    progress_percent: input.progressPercent,
    rating: input.rating,
    would_recommend: input.wouldRecommend,
    format: input.format,
    page_count: input.pageCount,
    duration_minutes: input.durationMinutes,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    notes: input.notes.trim(),
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    series_title: input.seriesTitle.trim() || null,
    series_index: input.seriesIndex,
    isbn: input.isbn.trim() || null,
    open_library_id: input.openLibraryId.trim() || null,
    cover_id: input.coverId,
    cover_color: input.coverColor,
    meta: {
      favorite: input.favorite,
      journal: input.journal,
    },
  };
}

function readBookMeta(value: unknown): { favorite: boolean; journal: BookJournal } {
  const meta = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const journal =
    meta.journal && typeof meta.journal === "object"
      ? (meta.journal as Record<string, unknown>)
      : {};
  const bookshelfType = journal.bookshelfType === "wishlist" || journal.bookshelfType === "regular"
    ? journal.bookshelfType
    : "";
  return {
    favorite: meta.favorite === true,
    journal: {
      description: text(journal.description),
      favoriteCharacter: text(journal.favoriteCharacter),
      sceneSummary: text(journal.sceneSummary),
      memorableMoments: text(journal.memorableMoments),
      leastFavoritePart: text(journal.leastFavoritePart),
      genre: text(journal.genre),
      bookshelfType,
      coverUrl: text(journal.coverUrl),
    },
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapDiscoveryRow(row: DiscoveryRow): StoredBookDiscoveryReport {
  const report = row.report as BookDiscoveryReport;
  return {
    id: row.id,
    model: row.model,
    createdAt: row.created_at,
    generatedAt: report.generatedAt,
    profile: report.profile,
    recommendations: report.recommendations ?? [],
    notForYou: report.notForYou ?? [],
  };
}

export function createSupabaseBookRepository(
  supabase: SupabaseClient,
  userId: string
): BookRepository {
  return {
    async listShelves() {
      const { data, error } = await supabase
        .from("bk_shelves")
        .select("id, name, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; name: string; slug: string }[]).map(
        (shelf): BookShelf => ({ ...shelf, builtin: false })
      );
    },

    async saveShelf(name) {
      const trimmed = name.trim();
      const slug = shelfSlug(trimmed);
      const { data, error } = await supabase
        .from("bk_shelves")
        .insert({ user_id: userId, name: trimmed, slug })
        .select("id, name, slug")
        .single();
      if (error) {
        throw new Error(error.code === "23505" ? "That shelf already exists." : error.message);
      }
      const shelf = data as { id: string; name: string; slug: string };
      return { ...shelf, builtin: false };
    },

    async removeShelf(id, destination) {
      const nextStatus = destination?.trim() ?? "";
      if (nextStatus && !/^[a-z0-9_-]{1,48}$/.test(nextStatus)) {
        throw new Error("Choose a shelf for these books.");
      }
      const { data, error: lookupError } = await supabase
        .from("bk_shelves")
        .select("slug")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      const slug = (data as { slug?: string } | null)?.slug;
      if (slug && nextStatus && slug !== nextStatus) {
        const { error: moveError } = await supabase
          .from("bk_books")
          .update(
            nextStatus === "read"
              ? { status: nextStatus, progress_percent: 100 }
              : { status: nextStatus }
          )
          .eq("user_id", userId)
          .eq("status", slug)
          .is("deleted_at", null);
        if (moveError) throw new Error(moveError.message);
      }
      const { error } = await supabase
        .from("bk_shelves")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },

    async list() {
      const { data, error } = await supabase
        .from("bk_books")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as BookRow[]).map(mapBookRow);
    },

    async save(input, id) {
      const payload = bookPayload(input);
      const query = id
        ? supabase
            .from("bk_books")
            .update(payload)
            .eq("id", id)
            .eq("user_id", userId)
        : supabase.from("bk_books").insert({ ...payload, user_id: userId });
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.message);
      return mapBookRow(data as BookRow);
    },

    async remove(id) {
      const { error } = await supabase
        .from("bk_books")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },

    async latestDiscovery() {
      const { data, error } = await supabase
        .from("bk_discovery_reports")
        .select("id, report, model, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapDiscoveryRow(data as DiscoveryRow) : null;
    },

    async saveDiscovery(report, model) {
      const { data, error } = await supabase
        .from("bk_discovery_reports")
        .insert({ user_id: userId, report, model })
        .select("id, report, model, created_at")
        .single();
      if (error) throw new Error(error.message);
      return mapDiscoveryRow(data as DiscoveryRow);
    },
  };
}
