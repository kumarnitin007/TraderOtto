"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";
import { createSupabaseWatchGroupRepository } from "@/lib/data/supabaseWatchGroupRepository";
import type { WatchGroup, WatchTracker } from "@/types/watchGroup";

type WatchGroupsContextValue = {
  groups: WatchGroup[];
  loading: boolean;
  error: string;
  readonly: boolean;
  addGroup: (name: string) => Promise<WatchGroup>;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  addTracker: (groupId: string, ticker: string) => void;
  updateTracker: (
    groupId: string,
    trackerId: string,
    patch: Partial<Pick<WatchTracker, "lowerTrigger" | "upperTrigger" | "notes">>
  ) => void;
  removeTracker: (groupId: string, trackerId: string) => void;
};

const WatchGroupsContext = createContext<WatchGroupsContextValue | null>(null);

function id() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function WatchGroupsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<WatchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const groupsRef = useRef<WatchGroup[]>([]);
  const queues = useRef(new Map<string, Promise<unknown>>());
  const readonly = !user || user.id === "local-bypass";
  const repository = useMemo(() => {
    const supabase = getSupabaseClient();
    return supabase && user && !readonly
      ? createSupabaseWatchGroupRepository(supabase, user.id)
      : null;
  }, [readonly, user]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    if (!repository) {
      groupsRef.current = [];
      setGroups([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    repository
      .list()
      .then((list) => {
        if (!cancelled) {
          groupsRef.current = list;
          setGroups(list);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          groupsRef.current = [];
          setGroups([]);
          setError(cause instanceof Error ? cause.message : "Could not load groups.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const queueUpdate = useCallback(
    (group: WatchGroup) => {
      if (!repository) {
        setError("Sign in to save groups.");
        return;
      }
      const previous = queues.current.get(group.id) ?? Promise.resolve();
      const next = previous
        .catch(() => undefined)
        .then(() => repository.update(group))
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "Could not save group.");
        });
      queues.current.set(group.id, next);
    },
    [repository]
  );

  const addGroup = useCallback(
    async (name: string) => {
      if (!repository) throw new Error("Sign in to create groups.");
      const group = await repository.add(name);
      groupsRef.current = [...groupsRef.current, group];
      setGroups(groupsRef.current);
      return group;
    },
    [repository]
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      const current = groupsRef.current.find((group) => group.id === groupId);
      if (!current) return;
      const updated = {
        ...current,
        name,
        updatedAt: new Date().toISOString(),
      };
      groupsRef.current = groupsRef.current.map((group) =>
        group.id === groupId ? updated : group
      );
      setGroups(groupsRef.current);
      queueUpdate(updated);
    },
    [queueUpdate]
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      if (!repository) {
        setError("Sign in to delete groups.");
        return;
      }
      groupsRef.current = groupsRef.current.filter((group) => group.id !== groupId);
      setGroups(groupsRef.current);
      void repository.remove(groupId).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not delete group.");
      });
    },
    [repository]
  );

  const addTracker = useCallback(
    (groupId: string, ticker: string) => {
      const group = groupsRef.current.find((entry) => entry.id === groupId);
      const symbol = ticker.trim().toUpperCase();
      if (
        !group ||
        !symbol ||
        group.trackers.some((tracker) => tracker.ticker === symbol)
      ) {
        return;
      }
      const updated = {
        ...group,
        trackers: [
          ...group.trackers,
          {
            id: id(),
            ticker: symbol,
            lowerTrigger: null,
            upperTrigger: null,
            notes: "",
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      groupsRef.current = groupsRef.current.map((entry) =>
        entry.id === groupId ? updated : entry
      );
      setGroups(groupsRef.current);
      queueUpdate(updated);
    },
    [queueUpdate]
  );

  const updateTracker = useCallback(
    (
      groupId: string,
      trackerId: string,
      patch: Partial<Pick<WatchTracker, "lowerTrigger" | "upperTrigger" | "notes">>
    ) => {
      const group = groupsRef.current.find((entry) => entry.id === groupId);
      if (!group) return;
      const updated = {
        ...group,
        trackers: group.trackers.map((tracker) =>
          tracker.id === trackerId ? { ...tracker, ...patch } : tracker
        ),
        updatedAt: new Date().toISOString(),
      };
      groupsRef.current = groupsRef.current.map((entry) =>
        entry.id === groupId ? updated : entry
      );
      setGroups(groupsRef.current);
      queueUpdate(updated);
    },
    [queueUpdate]
  );

  const removeTracker = useCallback(
    (groupId: string, trackerId: string) => {
      const group = groupsRef.current.find((entry) => entry.id === groupId);
      if (!group) return;
      const updated = {
        ...group,
        trackers: group.trackers.filter((tracker) => tracker.id !== trackerId),
        updatedAt: new Date().toISOString(),
      };
      groupsRef.current = groupsRef.current.map((entry) =>
        entry.id === groupId ? updated : entry
      );
      setGroups(groupsRef.current);
      queueUpdate(updated);
    },
    [queueUpdate]
  );

  const value = useMemo(
    () => ({
      groups,
      loading,
      error,
      readonly,
      addGroup,
      renameGroup,
      deleteGroup,
      addTracker,
      updateTracker,
      removeTracker,
    }),
    [
      groups,
      loading,
      error,
      readonly,
      addGroup,
      renameGroup,
      deleteGroup,
      addTracker,
      updateTracker,
      removeTracker,
    ]
  );

  return <WatchGroupsContext.Provider value={value}>{children}</WatchGroupsContext.Provider>;
}

export function useWatchGroups() {
  const context = useContext(WatchGroupsContext);
  if (!context) throw new Error("useWatchGroups must be used within WatchGroupsProvider");
  return context;
}
