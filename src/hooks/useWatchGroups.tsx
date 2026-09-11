"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WatchGroup, WatchTracker } from "@/types/watchGroup";

const STORAGE_KEY = "trader-otto:watch-groups";

type WatchGroupsContextValue = {
  groups: WatchGroup[];
  loading: boolean;
  addGroup: (name: string) => WatchGroup;
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
  const [groups, setGroups] = useState<WatchGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setGroups(raw ? (JSON.parse(raw) as WatchGroup[]) : []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = useCallback((update: (current: WatchGroup[]) => WatchGroup[]) => {
    setGroups((current) => {
      const next = update(current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addGroup = useCallback(
    (name: string) => {
      const now = new Date().toISOString();
      const group: WatchGroup = {
        id: id(),
        name: name.trim(),
        trackers: [],
        createdAt: now,
        updatedAt: now,
      };
      persist((current) => [...current, group]);
      return group;
    },
    [persist]
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) =>
      persist((current) =>
        current.map((group) =>
          group.id === groupId
            ? { ...group, name: name.trim(), updatedAt: new Date().toISOString() }
            : group
        )
      ),
    [persist]
  );

  const deleteGroup = useCallback(
    (groupId: string) => persist((current) => current.filter((group) => group.id !== groupId)),
    [persist]
  );

  const addTracker = useCallback(
    (groupId: string, ticker: string) =>
      persist((current) =>
        current.map((group) => {
          if (group.id !== groupId) return group;
          const symbol = ticker.trim().toUpperCase();
          if (!symbol || group.trackers.some((tracker) => tracker.ticker === symbol)) return group;
          return {
            ...group,
            trackers: [
              ...group.trackers,
              { id: id(), ticker: symbol, lowerTrigger: null, upperTrigger: null, notes: "" },
            ],
            updatedAt: new Date().toISOString(),
          };
        })
      ),
    [persist]
  );

  const updateTracker = useCallback(
    (
      groupId: string,
      trackerId: string,
      patch: Partial<Pick<WatchTracker, "lowerTrigger" | "upperTrigger" | "notes">>
    ) =>
      persist((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                trackers: group.trackers.map((tracker) =>
                  tracker.id === trackerId ? { ...tracker, ...patch } : tracker
                ),
                updatedAt: new Date().toISOString(),
              }
            : group
        )
      ),
    [persist]
  );

  const removeTracker = useCallback(
    (groupId: string, trackerId: string) =>
      persist((current) =>
        current.map((group) =>
          group.id === groupId
            ? {
                ...group,
                trackers: group.trackers.filter((tracker) => tracker.id !== trackerId),
                updatedAt: new Date().toISOString(),
              }
            : group
        )
      ),
    [persist]
  );

  const value = useMemo(
    () => ({
      groups,
      loading,
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
