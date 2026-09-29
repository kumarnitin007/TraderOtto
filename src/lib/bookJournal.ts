import { finishedBookBody } from "@/lib/journal";
import { createSupabaseJournalRepository } from "@/lib/data/supabaseJournalRepository";
import { todayISO } from "@/lib/pnl";
import { getSupabaseClient } from "@/lib/supabase";
import type { Book } from "@/types/book";

export function isFinishedBook(book: Pick<Book, "status" | "progressPercent">) {
  return book.status === "read" || book.progressPercent >= 100;
}

/** Creates or refreshes the single journal entry for a finished book. */
export async function syncFinishedBookJournal(book: Book, enabled: boolean) {
  if (!enabled || !isFinishedBook(book)) return;
  const supabase = getSupabaseClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user || user.id === "local-bypass") return;
  const repository = createSupabaseJournalRepository(supabase, user.id);
  await repository.upsertBookEntry(
    {
      kind: "entry",
      body: finishedBookBody(book),
      entryDate: book.finishedAt || todayISO(),
      tags: ["books"],
      sourceType: "book",
      sourceId: book.id,
    },
    book.id
  );
}
