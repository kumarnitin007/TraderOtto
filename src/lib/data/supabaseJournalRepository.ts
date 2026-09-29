import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalEntry, JournalInput } from "@/types/journal";

type Row = {
  id: string;
  kind: string;
  body: string;
  entry_date: string;
  prompt: string | null;
  tags: string[] | null;
  pinned: boolean;
  favorite: boolean;
  sort_order: number;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Row): JournalEntry {
  return {
    id: row.id,
    kind: row.kind === "note" ? "note" : "entry",
    body: row.body,
    entryDate: row.entry_date,
    prompt: row.prompt ?? "",
    tags: row.tags ?? [],
    pinned: row.pinned,
    favorite: row.favorite,
    sortOrder: row.sort_order,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bodyFor(input: JournalInput) {
  return {
    kind: input.kind,
    body: input.body.trim().slice(0, 8000),
    entry_date: input.entryDate,
    prompt: (input.prompt ?? "").slice(0, 180),
    tags: (input.tags ?? []).map((tag) => tag.trim().slice(0, 24)).filter(Boolean).slice(0, 6),
    pinned: Boolean(input.pinned),
    favorite: Boolean(input.favorite),
    sort_order: input.sortOrder ?? Date.now(),
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
  };
}

export function createSupabaseJournalRepository(client: SupabaseClient, userId: string) {
  return {
    async list(): Promise<JournalEntry[]> {
      const { data, error } = await client
        .from("jn_entries")
        .select("id,kind,body,entry_date,prompt,tags,pinned,favorite,sort_order,source_type,source_id,created_at,updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Row[]).map(mapRow);
    },
    async add(input: JournalInput): Promise<JournalEntry> {
      const { data, error } = await client
        .from("jn_entries")
        .insert({ ...bodyFor(input), user_id: userId })
        .select("id,kind,body,entry_date,prompt,tags,pinned,favorite,sort_order,source_type,source_id,created_at,updated_at")
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as Row);
    },
    async update(id: string, patch: Partial<JournalInput>): Promise<void> {
      const next: Record<string, unknown> = {};
      if (patch.body != null) next.body = patch.body.trim().slice(0, 8000);
      if (patch.entryDate != null) next.entry_date = patch.entryDate;
      if (patch.prompt != null) next.prompt = patch.prompt.slice(0, 180);
      if (patch.tags != null) next.tags = patch.tags;
      if (patch.pinned != null) next.pinned = patch.pinned;
      if (patch.favorite != null) next.favorite = patch.favorite;
      if (patch.sortOrder != null) next.sort_order = patch.sortOrder;
      const { error } = await client.from("jn_entries").update(next).eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async remove(id: string): Promise<void> {
      const { error } = await client
        .from("jn_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    async upsertBookEntry(input: JournalInput, bookId: string): Promise<void> {
      const { data, error } = await client
        .from("jn_entries")
        .select("id")
        .eq("user_id", userId)
        .eq("source_type", "book")
        .eq("source_id", bookId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data?.id) {
        await this.update(data.id, {
          body: input.body,
          entryDate: input.entryDate,
          tags: input.tags,
        });
        return;
      }
      await this.add({ ...input, sourceType: "book", sourceId: bookId, tags: input.tags ?? ["books"] });
    },
  };
}
