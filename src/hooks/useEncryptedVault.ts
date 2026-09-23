"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseClient } from "@/lib/supabase";
import { createSupabaseVaultRepository } from "@/lib/data/supabaseVaultRepository";
import {
  changeVaultMasterPassword,
  createVaultEnvelopeForUser,
  fetchVaultEnvelope,
  toSupabaseVaultSession,
  unlockVaultEnvelope,
  type VaultCryptoSession,
} from "@/lib/vault/envelope";
import {
  countPlaintextVault,
  deletePlaintextVaultDatabase,
  type VaultRepository,
} from "@/lib/vaultRepository";
import { migratePlaintextVault } from "@/lib/vault/migratePlaintextVault";

export type EncryptedVaultStatus =
  | "loading"
  | "setup"
  | "locked"
  | "unlocked"
  | "unavailable";

const DEFAULT_AUTO_LOCK_MINUTES = 5;
const AUTO_LOCK_OPTIONS = new Set([1, 5, 15, 30]);
const LOCK_CHANNEL = "otto-vault-lock-v1";

function safeAutoLock(value: unknown): number {
  const parsed = Number(value);
  return AUTO_LOCK_OPTIONS.has(parsed) ? parsed : DEFAULT_AUTO_LOCK_MINUTES;
}

function friendlyDatabaseError(message: string): string {
  if (/ov_vaults|relation|schema cache|could not find/i.test(message)) {
    return "Vault tables are not installed in Supabase. Run Design/supabase/vault-schema.sql, then retry.";
  }
  return message || "Encrypted Vault is unavailable.";
}

export function useEncryptedVault() {
  const { user } = useAuth();
  const [status, setStatus] = useState<EncryptedVaultStatus>("loading");
  const [repository, setRepository] = useState<VaultRepository | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState(
    DEFAULT_AUTO_LOCK_MINUTES
  );
  const [localCounts, setLocalCounts] = useState({ items: 0, tags: 0 });
  const [migrationPending, setMigrationPending] = useState(false);
  const sessionRef = useRef<VaultCryptoSession | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const settingsRef = useRef<Record<string, unknown>>({});
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const clearTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const lock = useCallback(
    (broadcast = true) => {
      clearTimer();
      sessionRef.current?.destroy();
      sessionRef.current = null;
      setRepository(null);
      setMigrationPending(false);
      setError("");
      setStatus((current) =>
        current === "unlocked" ? "locked" : current
      );
      if (broadcast) channelRef.current?.postMessage("lock");
    },
    [clearTimer]
  );

  const scheduleLock = useCallback(() => {
    clearTimer();
    if (!sessionRef.current) return;
    lockTimerRef.current = setTimeout(
      () => lock(),
      autoLockMinutes * 60_000
    );
  }, [autoLockMinutes, clearTimer, lock]);

  const loadLocalCounts = useCallback(async () => {
    try {
      const counts = await countPlaintextVault();
      setLocalCounts(counts);
      return counts;
    } catch {
      setError(
        "Otto could not verify whether legacy plaintext Vault data exists in this browser. Encrypted Vault is blocked to prevent leaving secrets behind."
      );
      return null;
    }
  }, []);

  const initialize = useCallback(async () => {
    lock(false);
    setStatus("loading");
    setError("");
    const counts = await loadLocalCounts();
    if (!counts) {
      setStatus("unavailable");
      return;
    }
    if (!user || user.method === "demo") {
      setStatus("unavailable");
      setError("Sign in with your Otto account to use encrypted Vault sync.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("unavailable");
      setError("Supabase is not configured for encrypted Vault sync.");
      return;
    }
    supabaseRef.current = supabase;
    const envelope = await fetchVaultEnvelope(supabase, user.id);
    if (!envelope.ok) {
      if (envelope.error.code === "VAULT_NOT_FOUND") {
        setStatus("setup");
        return;
      }
      setError(friendlyDatabaseError(envelope.error.message));
      setStatus("unavailable");
      return;
    }
    settingsRef.current = envelope.data.settings;
    setAutoLockMinutesState(
      safeAutoLock(envelope.data.settings.autoLockMinutes)
    );
    setStatus("locked");
  }, [loadLocalCounts, lock, user]);

  useEffect(() => {
    void initialize();
    return () => {
      clearTimer();
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, [initialize, clearTimer]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(LOCK_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data === "lock") lock(false);
    };
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [lock]);

  useEffect(() => {
    if (status !== "unlocked") return;
    const activity = () => scheduleLock();
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
    ];
    events.forEach((event) =>
      window.addEventListener(event, activity, { passive: true })
    );
    const visibility = () => {
      if (document.visibilityState === "hidden") lock();
    };
    document.addEventListener("visibilitychange", visibility);
    scheduleLock();
    return () => {
      events.forEach((event) => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", visibility);
      clearTimer();
    };
  }, [status, scheduleLock, lock, clearTimer]);

  const finishUnlock = useCallback(
    async (session: VaultCryptoSession) => {
      const supabase = supabaseRef.current;
      if (!supabase || !user) {
        session.destroy();
        throw new Error("Supabase session is unavailable.");
      }
      sessionRef.current?.destroy();
      sessionRef.current = session;
      setRepository(
        createSupabaseVaultRepository(
          supabase,
          user.id,
          toSupabaseVaultSession(session)
        )
      );
      const counts = await loadLocalCounts();
      if (!counts) {
        session.destroy();
        sessionRef.current = null;
        setRepository(null);
        setStatus("unavailable");
        return;
      }
      setMigrationPending(counts.items > 0 || counts.tags > 0);
      setStatus("unlocked");
      setError("");
    },
    [loadLocalCounts, user]
  );

  const setup = useCallback(
    async (password: string, minutes: number) => {
      const supabase = supabaseRef.current;
      if (!supabase || !user) return;
      setBusy(true);
      setError("");
      let envelopeCreated = false;
      try {
        const created = await createVaultEnvelopeForUser(
          supabase,
          user.id,
          password
        );
        if (!created.ok) throw new Error(created.error.message);
        envelopeCreated = true;
        const settings = { autoLockMinutes: safeAutoLock(minutes) };
        const { error: settingsError } = await supabase
          .from("ov_vaults")
          .update({ settings })
          .eq("user_id", user.id);
        if (!settingsError) {
          settingsRef.current = settings;
          setAutoLockMinutesState(settings.autoLockMinutes);
        }
        const unlocked = await unlockVaultEnvelope(
          supabase,
          user.id,
          password
        );
        if (!unlocked.ok) throw new Error(unlocked.error.message);
        await finishUnlock(unlocked.data);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not create Vault."
        );
        if (envelopeCreated) setStatus("locked");
      } finally {
        setBusy(false);
      }
    },
    [finishUnlock, user]
  );

  const unlock = useCallback(
    async (password: string) => {
      const supabase = supabaseRef.current;
      if (!supabase || !user) return;
      setBusy(true);
      setError("");
      try {
        const result = await unlockVaultEnvelope(supabase, user.id, password);
        if (!result.ok) throw new Error("Incorrect master password.");
        const envelope = await fetchVaultEnvelope(supabase, user.id);
        if (envelope.ok) {
          settingsRef.current = envelope.data.settings;
          setAutoLockMinutesState(
            safeAutoLock(envelope.data.settings.autoLockMinutes)
          );
        }
        await finishUnlock(result.data);
      } catch {
        setError("Incorrect master password or vault data is unavailable.");
      } finally {
        setBusy(false);
      }
    },
    [finishUnlock, user]
  );

  const updateSettings = useCallback(
    async (settings: Record<string, unknown>) => {
      const supabase = supabaseRef.current;
      if (!supabase || !user) throw new Error("Supabase is unavailable.");
      const next = { ...settingsRef.current, ...settings };
      const { error: updateError } = await supabase
        .from("ov_vaults")
        .update({ settings: next })
        .eq("user_id", user.id);
      if (updateError) throw new Error(updateError.message);
      settingsRef.current = next;
    },
    [user]
  );

  const updateAutoLock = useCallback(
    async (minutes: number) => {
      const safe = safeAutoLock(minutes);
      setAutoLockMinutesState(safe);
      setError("");
      try {
        await updateSettings({ autoLockMinutes: safe });
        scheduleLock();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not save auto-lock."
        );
      }
    },
    [scheduleLock, updateSettings]
  );

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      const supabase = supabaseRef.current;
      const session = sessionRef.current;
      if (!supabase || !user || !session) return false;
      setBusy(true);
      setError("");
      try {
        const validation = await unlockVaultEnvelope(
          supabase,
          user.id,
          currentPassword
        );
        if (!validation.ok) throw new Error("Current master password is incorrect.");
        validation.data.destroy();
        const result = await changeVaultMasterPassword(
          supabase,
          session,
          nextPassword
        );
        if (!result.ok) throw new Error(result.error.message);
        return true;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not change master password."
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [user]
  );

  const migrate = useCallback(async () => {
    const supabase = supabaseRef.current;
    const session = sessionRef.current;
    if (!supabase || !user || !session || !repository) return;
    setBusy(true);
    setError("");
    try {
      await migratePlaintextVault({
        cloudRepository: repository,
        supabase,
        userId: user.id,
        keyVersion: session.keyVersion,
      });
      setLocalCounts({ items: 0, tags: 0 });
      setMigrationPending(false);
      await updateSettings({
        migratedFromLocalAt: new Date().toISOString(),
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Migration failed safely."
      );
    } finally {
      setBusy(false);
    }
  }, [repository, updateSettings, user]);

  const discardPlaintext = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await deletePlaintextVaultDatabase();
      setLocalCounts({ items: 0, tags: 0 });
      setMigrationPending(false);
      await updateSettings({
        discardedLocalPlaintextAt: new Date().toISOString(),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Local plaintext could not be deleted."
      );
    } finally {
      setBusy(false);
    }
  }, [updateSettings]);

  return {
    status,
    repository,
    error,
    busy,
    autoLockMinutes,
    localCounts,
    migrationPending,
    setup,
    unlock,
    lock: () => lock(),
    retry: initialize,
    updateAutoLock,
    changePassword,
    migrate,
    discardPlaintext,
  };
}
