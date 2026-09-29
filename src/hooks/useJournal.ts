"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createSupabaseJournalRepository } from "@/lib/data/supabaseJournalRepository";
import { getSupabaseClient } from "@/lib/supabase";
import type { JournalEntry, JournalInput } from "@/types/journal";

function schemaMessage(message: string) {
  return /jn_entries|schema cache/i.test(message)
    ? "Run the Journal table script in Supabase, then reload."
    : message;
}

export function useJournal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly ? createSupabaseJournalRepository(supabase, user.id) : null;
  }, [readonly, user]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEntries(await repository.list());
      setError("");
    } catch (cause) {
      setError(schemaMessage(cause instanceof Error ? cause.message : "Could not load the journal."));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add(input: JournalInput) {
    if (!repository) throw new Error("Sign in to save journal entries.");
    const created = await repository.add(input);
    setEntries((current) => [created, ...current]);
    return created;
  }

  async function update(id: string, patch: Partial<JournalInput>) {
    if (!repository) throw new Error("Sign in to edit journal entries.");
    await repository.update(id, patch);
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              tags: patch.tags ?? entry.tags,
              prompt: patch.prompt ?? entry.prompt,
            }
          : entry
      )
    );
  }

  async function remove(id: string) {
    if (!repository) throw new Error("Sign in to delete journal entries.");
    await repository.remove(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return { entries, loading, error, readonly, add, update, remove, refresh };
}
