"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createSupabaseUserScreensRepository } from "@/lib/data/supabaseUserScreensRepository";
import { getSupabaseClient } from "@/lib/supabase";
import { friendlyUserScreensError } from "@/lib/userScreensRepository";
import type {
  UserScreen,
  UserScreenInput,
  UserScreenRow,
  UserScreenRowData,
} from "@/types/userScreens";

export function useUserScreens() {
  const { user } = useAuth();
  const readonly = !user || user.id === "local-bypass";
  const userId = user?.id;
  const [lists, setLists] = useState<UserScreen[]>([]);
  const [rows, setRows] = useState<Record<string, UserScreenRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const repository = useMemo(() => {
    const client = getSupabaseClient();
    return client && userId && !readonly
      ? createSupabaseUserScreensRepository(client, userId)
      : null;
  }, [readonly, userId]);

  const refresh = useCallback(async () => {
    if (!repository) {
      setLists([]);
      setRows({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextLists = await repository.getLists();
      const pairs = await Promise.all(
        nextLists.map(async (list) => [list.id, await repository.getRows(list.id)] as const),
      );
      setLists(nextLists);
      setRows(Object.fromEntries(pairs));
      setError("");
    } catch (cause) {
      setError(friendlyUserScreensError(cause).message);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createList(input: UserScreenInput, initialRows: UserScreenRowData[] = []) {
    if (!repository) throw new Error("Sign in to save User Screens.");
    let list: UserScreen | null = null;
    try {
      list = await repository.createList(input);
      const createdList = list;
      const savedRows = initialRows.length
        ? await repository.addRows(createdList.id, initialRows)
        : [];
      setLists((current) => [...current, createdList]);
      setRows((current) => ({ ...current, [createdList.id]: savedRows }));
      return createdList;
    } catch (cause) {
      if (list) await repository.deleteList(list.id).catch(() => undefined);
      throw friendlyUserScreensError(cause);
    }
  }

  async function updateList(id: string, input: UserScreenInput) {
    if (!repository) throw new Error("Sign in to update User Screens.");
    try {
      const saved = await repository.updateList(id, input);
      setLists((current) => current.map((list) => (list.id === id ? saved : list)));
      return saved;
    } catch (cause) {
      throw friendlyUserScreensError(cause);
    }
  }

  async function deleteList(id: string) {
    if (!repository) throw new Error("Sign in to delete User Screens.");
    await repository.deleteList(id);
    setLists((current) => current.filter((list) => list.id !== id));
    setRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function addRows(listId: string, data: UserScreenRowData[]) {
    if (!repository) throw new Error("Sign in to add rows.");
    try {
      const saved = await repository.addRows(listId, data);
      setRows((current) => ({
        ...current,
        [listId]: [...(current[listId] ?? []), ...saved],
      }));
      return saved;
    } catch (cause) {
      throw friendlyUserScreensError(cause);
    }
  }

  function setRowLocal(listId: string, rowId: string, data: UserScreenRowData) {
    setRows((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).map((row) =>
        row.id === rowId ? { ...row, data } : row,
      ),
    }));
  }

  async function updateRow(listId: string, rowId: string, data: UserScreenRowData) {
    if (!repository) throw new Error("Sign in to update rows.");
    setRowLocal(listId, rowId, data);
    try {
      const saved = await repository.updateRow(rowId, data);
      setRows((current) => ({
        ...current,
        [listId]: (current[listId] ?? []).map((row) => (row.id === rowId ? saved : row)),
      }));
      return saved;
    } catch (cause) {
      void refresh();
      throw friendlyUserScreensError(cause);
    }
  }

  async function deleteRow(listId: string, rowId: string) {
    if (!repository) throw new Error("Sign in to delete rows.");
    await repository.deleteRow(rowId);
    setRows((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).filter((row) => row.id !== rowId),
    }));
  }

  async function deleteRows(listId: string) {
    if (!repository) throw new Error("Sign in to delete rows.");
    await repository.deleteRows(listId);
    setRows((current) => ({ ...current, [listId]: [] }));
  }

  return {
    lists,
    rows,
    loading,
    error,
    readonly,
    refresh,
    createList,
    updateList,
    deleteList,
    addRows,
    setRowLocal,
    updateRow,
    deleteRow,
    deleteRows,
  };
}
