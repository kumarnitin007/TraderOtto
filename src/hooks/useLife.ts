"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createSupabaseLifeRepository } from "@/lib/data/supabaseLifeRepository";
import { isoDay, daysAgo } from "@/lib/lifeTasks";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  LifeInput,
  LifeItem,
  LifeList,
  LifeListItem,
  LifeListItemInput,
  LifeTask,
  LifeTaskCheck,
  LifeTaskInput,
} from "@/types/life";

function schemaMessage(message: string) {
  return /lf_items|lf_tasks|lf_task_checks|lf_lists|lf_list_items|schema cache/i.test(message)
    ? "Run the Life table script in Supabase, then reload."
    : message;
}

export function useLife() {
  const { user } = useAuth();
  const [items, setItems] = useState<LifeItem[]>([]);
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [checks, setChecks] = useState<LifeTaskCheck[]>([]);
  const [lists, setLists] = useState<LifeList[]>([]);
  const [listItems, setListItems] = useState<LifeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [listError, setListError] = useState("");
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
      setTasks([]);
      setChecks([]);
      setLists([]);
      setListItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setTaskError("");
    setListError("");
    const fromDay = isoDay(daysAgo(new Date(), 21));
    const [dates, tracked, listed] = await Promise.allSettled([
      repository.list(),
      Promise.all([repository.listTasks(), repository.listChecks(fromDay)]),
      Promise.all([repository.listLists(), repository.listListItems()]),
    ]);
    if (dates.status === "fulfilled") setItems(dates.value);
    else setError(schemaMessage(dates.reason instanceof Error ? dates.reason.message : "Could not load dates."));
    if (tracked.status === "fulfilled") {
      setTasks(tracked.value[0]);
      setChecks(tracked.value[1]);
    } else {
      setTaskError(
        schemaMessage(tracked.reason instanceof Error ? tracked.reason.message : "Could not load tasks."),
      );
    }
    if (listed.status === "fulfilled") {
      setLists(listed.value[0]);
      setListItems(listed.value[1]);
    } else {
      setListError(
        schemaMessage(listed.reason instanceof Error ? listed.reason.message : "Could not load lists."),
      );
    }
    setLoading(false);
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

  const saveTask = useCallback(
    async (input: LifeTaskInput, id?: string) => {
      if (!repository) throw new Error("Sign in to save.");
      const saved = await repository.saveTask(input, id);
      setTasks((current) => [...current.filter((task) => task.id !== saved.id), saved]);
      return saved;
    },
    [repository],
  );

  const removeTask = useCallback(
    async (id: string) => {
      if (!repository) throw new Error("Sign in to save.");
      await repository.removeTask(id);
      setTasks((current) => current.filter((task) => task.id !== id));
      setChecks((current) => current.filter((check) => check.taskId !== id));
    },
    [repository],
  );

  const toggleToday = useCallback(
    async (taskId: string, doneOn?: string) => {
      if (!repository) throw new Error("Sign in to save.");
      const today = doneOn ?? isoDay(new Date());
      const existing = checks.find((check) => check.taskId === taskId && check.doneOn === today);
      if (existing) {
        await repository.removeCheck(existing.id);
        setChecks((current) => current.filter((check) => check.id !== existing.id));
        return;
      }
      const saved = await repository.addCheck(taskId, today);
      setChecks((current) => [...current, saved]);
    },
    [checks, repository],
  );

  const saveList = useCallback(
    async (name: string, id?: string) => {
      if (!repository) throw new Error("Sign in to save.");
      const saved = await repository.saveList(name, id);
      setLists((current) => [...current.filter((list) => list.id !== saved.id), saved]);
      return saved;
    },
    [repository],
  );

  const removeList = useCallback(
    async (id: string) => {
      if (!repository) throw new Error("Sign in to save.");
      await repository.removeList(id);
      setLists((current) => current.filter((list) => list.id !== id));
      setListItems((current) => current.filter((item) => item.listId !== id));
    },
    [repository],
  );

  const saveListItem = useCallback(
    async (input: LifeListItemInput, id?: string) => {
      if (!repository) throw new Error("Sign in to save.");
      const saved = await repository.saveListItem(input, id);
      setListItems((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      return saved;
    },
    [repository],
  );

  const removeListItem = useCallback(
    async (id: string) => {
      if (!repository) throw new Error("Sign in to save.");
      await repository.removeListItem(id);
      setListItems((current) => current.filter((item) => item.id !== id));
    },
    [repository],
  );

  return {
    items,
    tasks,
    checks,
    lists,
    listItems,
    loading,
    error,
    taskError,
    listError,
    readonly,
    refresh,
    save,
    remove,
    saveTask,
    removeTask,
    toggleToday,
    saveList,
    removeList,
    saveListItem,
    removeListItem,
  };
}
