import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookRepository } from "@/lib/bookRepository";
import type {
  Book,
  BookDiscoveryReport,
  BookFormat,
  BookInput,
  BookStatus,
  StoredBookDiscoveryReport,
} from "@/types/book";

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  status: BookStatus;
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
  };
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
