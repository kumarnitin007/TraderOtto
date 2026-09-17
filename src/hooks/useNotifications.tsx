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
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notificationDefaults";
import {
  createSupabaseNotificationRepository,
  type NotificationRepository,
} from "@/lib/data/supabaseNotificationRepository";
import { firedToday } from "@/lib/notificationDedupe";
import type {
  NotificationPreferences,
  NotificationSignal,
  SignalDraft,
} from "@/types/notification";

type NotificationContextValue = {
  preferences: NotificationPreferences;
  signals: NotificationSignal[];
  loading: boolean;
  error: string;
  unreadCount: number;
  updatePreferences: (next: NotificationPreferences) => Promise<void>;
  fire: (draft: SignalDraft) => Promise<void>;
  clearCondition: (dedupeKey: string) => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  hide: (id: string) => Promise<void>;
  hideMany: (ids: string[]) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [signals, setSignals] = useState<NotificationSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const repository = useMemo<NotificationRepository | null>(() => {
    const supabase = getSupabaseClient();
    return supabase && user && user.id !== "local-bypass"
      ? createSupabaseNotificationRepository(supabase, user.id, user.email)
      : null;
  }, [user]);
  const repoRef = useRef(repository);
  const signalsRef = useRef(signals);
  const saveQueueRef = useRef(Promise.resolve());
  repoRef.current = repository;
  signalsRef.current = signals;

  useEffect(() => {
    let cancelled = false;
    if (!repository) {
      setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      setSignals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([repository.loadPreferences(), repository.listSignals()])
      .then(([nextPreferences, nextSignals]) => {
        if (cancelled) return;
        setPreferences(nextPreferences);
        setSignals(nextSignals);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load notifications.");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const updatePreferences = useCallback(async (next: NotificationPreferences) => {
    setPreferences(next);
    if (!repoRef.current) return;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => repoRef.current?.savePreferences(next))
      .then(() => setError(""))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not save preferences.");
      });
    await saveQueueRef.current;
  }, []);

  const fire = useCallback(async (draft: SignalDraft) => {
    const repo = repoRef.current;
    if (!repo) return;
    if (firedToday(signalsRef.current, draft.dedupeKey)) {
      return;
    }
    try {
      const created = await repo.createSignal(draft);
      setSignals((current) => [created, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create alert.");
    }
  }, []);

  const clearCondition = useCallback(async (dedupeKey: string) => {
    const repo = repoRef.current;
    const matching = signalsRef.current.filter(
      (signal) => signal.status === "open" && signal.dedupeKey === dedupeKey
    );
    if (!repo || !matching.length) return;
    setSignals((current) =>
      current.map((signal) =>
        signal.status === "open" && signal.dedupeKey === dedupeKey
          ? { ...signal, status: "acked" }
          : signal
      )
    );
    await repo.acknowledgeByKey(dedupeKey).catch(() => undefined);
  }, []);

  const acknowledge = useCallback(async (id: string) => {
    const repo = repoRef.current;
    if (!repo) return;
    setSignals((current) =>
      current.map((signal) =>
        signal.id === id ? { ...signal, status: "acked" } : signal
      )
    );
    await repo.acknowledge(id).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not clear alert.");
    });
  }, []);

  const acknowledgeAll = useCallback(async () => {
    const ids = signalsRef.current
      .filter((signal) => signal.status === "open")
      .map((signal) => signal.id);
    setSignals((current) =>
      current.map((signal) =>
        signal.status === "open" ? { ...signal, status: "acked" } : signal
      )
    );
    await Promise.all(ids.map((id) => repoRef.current?.acknowledge(id)));
  }, []);

  const hideMany = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setSignals((current) => current.filter((signal) => !idSet.has(signal.id)));
    await repoRef.current?.hide(ids).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not remove alerts.");
    });
  }, []);

  const hide = useCallback(
    async (id: string) => {
      await hideMany([id]);
    },
    [hideMany]
  );

  const value = useMemo(
    () => ({
      preferences,
      signals,
      loading,
      error,
      unreadCount: signals.filter(
        (signal) =>
          signal.status === "open" && preferences.events[signal.kind]?.inApp !== false
      ).length,
      updatePreferences,
      fire,
      clearCondition,
      acknowledge,
      acknowledgeAll,
      hide,
      hideMany,
    }),
    [
      preferences,
      signals,
      loading,
      error,
      updatePreferences,
      fire,
      clearCondition,
      acknowledge,
      acknowledgeAll,
      hide,
      hideMany,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}
