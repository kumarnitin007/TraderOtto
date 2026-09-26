"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createSupabaseLifeRepository } from "@/lib/data/supabaseLifeRepository";
import { getSupabaseClient } from "@/lib/supabase";
import type { LifeInput, LifeItem } from "@/types/life";

export function useLife() {
  const { user } = useAuth();
  const [items, setItems] = useState<LifeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly
      ? createSupabaseLifeRepository(supabase, user.id)
      : null;
  }, [readonly, user]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setItems(await repository.list());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load Life.";
      setError(
        /lf_items|schema cache/i.test(message)
          ? "Run the Life table script in Supabase, then reload."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const save = useCallback(
    async (input: LifeInput, id?: string) => {
      if (!repository) throw new Error("Sign in to save.");
      const saved = await repository.save(input, id);
      setItems((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      return saved;
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!repository) throw new Error("Sign in to save.");
      await repository.remove(id);
      setItems((current) => current.filter((item) => item.id !== id));
    },
    [repository],
  );

  return { items, loading, error, readonly, refresh, save, remove };
}
