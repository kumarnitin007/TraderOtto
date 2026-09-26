"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BUILTIN_SHELVES } from "@/lib/books";
import { createSupabaseBookRepository } from "@/lib/data/supabaseBookRepository";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  Book,
  BookDiscoveryReport,
  BookInput,
  BookShelf,
  StoredBookDiscoveryReport,
} from "@/types/book";

export function useBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [customShelves, setCustomShelves] = useState<BookShelf[]>([]);
  const [discovery, setDiscovery] = useState<StoredBookDiscoveryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly
      ? createSupabaseBookRepository(supabase, user.id)
      : null;
  }, [readonly, user]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setBooks([]);
      setDiscovery(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextBooks, nextDiscovery] = await Promise.all([
        repository.list(),
        repository.latestDiscovery(),
      ]);
      setBooks(nextBooks);
      setDiscovery(nextDiscovery);
      try {
        setCustomShelves(await repository.listShelves());
      } catch {
        setCustomShelves([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your books.");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveBook = useCallback(
    async (input: BookInput, id?: string) => {
      if (!repository) throw new Error("Sign in to save books.");
      const saved = await repository.save(input, id);
      setBooks((current) => {
        const exists = current.some((book) => book.id === saved.id);
        return exists
          ? current.map((book) => (book.id === saved.id ? saved : book))
          : [saved, ...current];
      });
      return saved;
    },
    [repository]
  );

  const deleteBook = useCallback(
    async (id: string) => {
      if (!repository) throw new Error("Sign in to delete books.");
      await repository.remove(id);
      setBooks((current) => current.filter((book) => book.id !== id));
    },
    [repository]
  );

  const saveDiscovery = useCallback(
    async (report: BookDiscoveryReport, model: string) => {
      if (!repository) throw new Error("Sign in to save recommendations.");
      const saved = await repository.saveDiscovery(report, model);
      setDiscovery(saved);
      return saved;
    },
    [repository]
  );

  const addShelf = useCallback(
    async (name: string) => {
      if (!repository) throw new Error("Sign in to add shelves.");
      const saved = await repository.saveShelf(name);
      setCustomShelves((current) => [...current, saved]);
      return saved;
    },
    [repository]
  );

  const removeShelf = useCallback(
    async (shelf: BookShelf) => {
      if (!repository || shelf.builtin) return;
      await repository.removeShelf(shelf.id);
      setCustomShelves((current) => current.filter((item) => item.id !== shelf.id));
      setBooks((current) =>
        current.map((book) =>
          book.status === shelf.slug ? { ...book, status: "want_to_read" } : book
        )
      );
    },
    [repository]
  );

  const shelves = useMemo(
    () => [...BUILTIN_SHELVES, ...customShelves],
    [customShelves]
  );

  return {
    books,
    shelves,
    discovery,
    loading,
    error,
    readonly,
    refresh,
    saveBook,
    deleteBook,
    saveDiscovery,
    addShelf,
    removeShelf,
  };
}
