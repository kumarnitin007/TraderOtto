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
import {
  firedWithinCooldown,
  groupFiredWithinCooldown,
  notificationGroupKey,
} from "@/lib/notificationSmart";
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
  const preferencesRef = useRef(preferences);
  const saveQueueRef = useRef(Promise.resolve());
  repoRef.current = repository;
  signalsRef.current = signals;
  preferencesRef.current = preferences;

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
    if (
      firedWithinCooldown(
        signalsRef.current,
        draft.dedupeKey,
        preferencesRef.current.repeatCooldownHours
      ) ||
      groupFiredWithinCooldown(
        signalsRef.current,
        draft,
        preferencesRef.current.repeatCooldownHours
      )
    ) {
      return;
    }
    // Keep one active inbox row per live condition. External channels may
    // repeat after the cooldown without creating another in-app duplicate.
    if (
      signalsRef.current.some(
        (signal) =>
          signal.status === "open" &&
          notificationGroupKey(signal) === notificationGroupKey(draft)
      )
    ) {
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
    const groupKey = dedupeKey.startsWith("smart:")
      ? dedupeKey.slice("smart:".length)
      : null;
    const matching = signalsRef.current.filter(
      (signal) =>
        signal.status === "open" &&
        (signal.dedupeKey === dedupeKey ||
          (groupKey != null && notificationGroupKey(signal) === groupKey))
    );
    if (!repo || !matching.length) return;
    setSignals((current) =>
      current.map((signal) =>
        matching.some((match) => match.id === signal.id)
          ? { ...signal, status: "acked" }
          : signal
      )
    );
    await Promise.all(
      matching.map((signal) => repo.acknowledge(signal.id))
    ).catch(() => undefined);
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
      unreadCount: new Set(
        signals
          .filter(
            (signal) =>
              signal.status === "open" &&
              preferences.events[signal.kind]?.inApp !== false
          )
          .map(notificationGroupKey)
      ).size,
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
