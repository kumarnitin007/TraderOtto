"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Lock, ShieldCheck, WifiOff } from "lucide-react";
import {
  MIN_MASTER_PASSWORD_LENGTH,
  RECOMMENDED_MASTER_PASSWORD_LENGTH,
} from "@/lib/vault/crypto";

const AUTO_LOCK_OPTIONS = [1, 5, 15, 30] as const;

const inputClassName =
  "w-full rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[15px]";

export type VaultUnlockMode = "setup" | "unlock" | "unavailable";

export type VaultUnlockScreenProps = {
  mode: VaultUnlockMode;
  loading?: boolean;
  error?: string | null;
  localItemCount?: number;
  onSetup: (password: string, autoLockMinutes: number) => void;
  onUnlock: (password: string) => void;
  onRetry?: () => void;
};

function masterStrengthHint(password: string): {
  label: string;
  bars: number;
  ok: boolean;
} {
  const len = password.length;
  if (len === 0) {
    return {
      label: `At least ${MIN_MASTER_PASSWORD_LENGTH} characters required`,
      bars: 0,
      ok: false,
    };
  }
  const hasSpace = /\s/.test(password);
  const wordLike = password.split(/\s+/).filter(Boolean).length;
  const passphrase = hasSpace && wordLike >= 3;
  if (len < MIN_MASTER_PASSWORD_LENGTH) {
    return {
      label: `${MIN_MASTER_PASSWORD_LENGTH - len} more character${
        len === MIN_MASTER_PASSWORD_LENGTH - 1 ? "" : "s"
      } needed`,
      bars: 0,
      ok: false,
    };
  }
  if (len < RECOMMENDED_MASTER_PASSWORD_LENGTH && !passphrase) {
    return {
      label: `Allowed, but short. ${RECOMMENDED_MASTER_PASSWORD_LENGTH}+ characters is much safer`,
      bars: 1,
      ok: true,
    };
  }
  if (passphrase) {
    return { label: "Strong passphrase", bars: 4, ok: true };
  }
  if (len >= 20) {
    return { label: "Strong password", bars: 4, ok: true };
  }
  return { label: "Recommended length — a passphrase is easier to remember", bars: 3, ok: true };
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">{label}</span>
      <div className="flex items-center rounded-[10px] border border-otto-divider bg-otto-surface pr-2">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          className="!w-full !border-0 bg-transparent px-3 py-2.5 !text-[15px]"
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="shrink-0 px-2 text-[12px] font-semibold text-otto-text-dim"
          aria-pressed={show}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}

export function VaultUnlockScreen({
  mode,
  loading = false,
  error = null,
  localItemCount = 0,
  onSetup,
  onUnlock,
  onRetry,
}: VaultUnlockScreenProps) {
  const formId = useId();
  const recoveryId = `${formId}-recovery`;
  const strengthId = `${formId}-strength`;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ackNoRecovery, setAckNoRecovery] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(5);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setPassword("");
    setConfirm("");
    setAckNoRecovery(false);
    setLocalError(null);
  }, [mode]);

  const strength = useMemo(() => masterStrengthHint(password), [password]);

  const displayError = localError ?? error;

  function clearSecrets() {
    setPassword("");
    setConfirm("");
  }

  function handleSetupSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!strength.ok) {
      setLocalError(
        `Master password must be at least ${MIN_MASTER_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (!ackNoRecovery) {
      setLocalError("Confirm that you understand there is no password recovery.");
      return;
    }
    const next = password;
    clearSecrets();
    onSetup(next, autoLockMinutes);
  }

  function handleUnlockSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!password.trim()) {
      setLocalError("Enter your master password.");
      return;
    }
    const next = password;
    clearSecrets();
    onUnlock(next);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-otto-bg text-otto-text">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-[18px] py-8 pb-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-otto-green-soft text-otto-green">
          {mode === "unavailable" ? (
            <WifiOff size={28} aria-hidden />
          ) : mode === "setup" ? (
            <ShieldCheck size={28} aria-hidden />
          ) : (
            <Lock size={28} aria-hidden />
          )}
        </div>

        {mode === "setup" && (
          <>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Encrypted vault
            </p>
            <h1 className="text-center text-[26px] font-extrabold tracking-[-0.4px]">
              Create your master password
            </h1>
            <p className="mt-2 text-center text-[13.5px] leading-relaxed text-otto-text-dim">
              This password encrypts your vault on this device and wraps your vault key for sync.
              Otto never stores it on the server.
            </p>
            {localItemCount > 0 && (
              <p className="mt-3 text-center text-[13px] text-otto-text-dim">
                You have {localItemCount} local{" "}
                {localItemCount === 1 ? "item" : "items"} — migrate them after setup if prompted.
              </p>
            )}

            <form
              onSubmit={handleSetupSubmit}
              className="mt-6 flex flex-col gap-4"
              aria-busy={loading}
            >
              <PasswordField
                id={`${formId}-master`}
                label="Master password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                describedBy={strengthId}
              />
              <div id={strengthId} className="flex items-center gap-1.5" aria-live="polite">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`h-1.5 flex-1 rounded-full ${
                      index < strength.bars
                        ? password.length < RECOMMENDED_MASTER_PASSWORD_LENGTH
                          ? "bg-otto-amber"
                          : "bg-otto-green"
                        : "bg-otto-divider"
                    }`}
                  />
                ))}
                <span className="ml-2 text-[12px] text-otto-text-dim">{strength.label}</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-otto-text-dim">
                Use a long passphrase (several random words) or a password manager. Minimum{" "}
                {MIN_MASTER_PASSWORD_LENGTH} characters; {RECOMMENDED_MASTER_PASSWORD_LENGTH}+ is
                strongly recommended.
              </p>
              {password.length >= MIN_MASTER_PASSWORD_LENGTH &&
                password.length < RECOMMENDED_MASTER_PASSWORD_LENGTH && (
                  <div className="flex gap-2 rounded-xl border border-otto-amber/35 bg-otto-amber-soft px-3.5 py-3">
                    <AlertTriangle
                      size={18}
                      className="mt-0.5 shrink-0 text-otto-amber"
                      aria-hidden
                    />
                    <p className="text-[12.5px] leading-relaxed text-otto-text-dim">
                      Short master passwords are easier to guess. Prefer a 14+ character passphrase
                      unless this is only a test vault.
                    </p>
                  </div>
                )}

              <PasswordField
                id={`${formId}-confirm`}
                label="Confirm master password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />

              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-otto-text-dim">
                  Auto-lock after inactivity
                </span>
                <select
                  value={autoLockMinutes}
                  onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
                  className={inputClassName}
                  disabled={loading}
                >
                  {AUTO_LOCK_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minute{minutes === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-otto-amber/35 bg-otto-amber-soft px-3.5 py-3">
                <div className="flex gap-2">
                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-otto-amber"
                    aria-hidden
                  />
                  <p className="text-[12.5px] leading-relaxed text-otto-text-dim">
                    <strong className="font-semibold text-otto-text">No password recovery.</strong>{" "}
                    If you forget your master password, Otto cannot reset it or decrypt your vault.
                    Store it safely or use a password manager.
                  </p>
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                  <input
                    id={recoveryId}
                    type="checkbox"
                    checked={ackNoRecovery}
                    onChange={(event) => setAckNoRecovery(event.target.checked)}
                    disabled={loading}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-otto-green"
                  />
                  <span className="text-[13px] leading-snug text-otto-text">
                    I understand there is no way to recover my master password
                  </span>
                </label>
              </div>

              {displayError && (
                <p role="alert" className="text-[13px] font-medium text-otto-red">
                  {displayError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  !strength.ok ||
                  !confirm ||
                  password !== confirm ||
                  !ackNoRecovery
                }
                className={`w-full rounded-xl py-3 text-[14px] font-bold ${
                  !loading && strength.ok && confirm && password === confirm && ackNoRecovery
                    ? "bg-otto-green text-black"
                    : "bg-otto-surface text-otto-text-faint"
                }`}
              >
                {loading ? "Creating vault…" : "Create encrypted vault"}
              </button>
            </form>
          </>
        )}

        {mode === "unlock" && (
          <>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Locked
            </p>
            <h1 className="text-center text-[26px] font-extrabold tracking-[-0.4px]">
              Unlock your vault
            </h1>
            <p className="mt-2 text-center text-[13.5px] leading-relaxed text-otto-text-dim">
              Enter your master password to decrypt items on this device.
            </p>

            <form
              onSubmit={handleUnlockSubmit}
              className="mt-6 flex flex-col gap-4"
              aria-busy={loading}
            >
              <PasswordField
                id={`${formId}-unlock`}
                label="Master password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />

              {displayError && (
                <p role="alert" className="text-[13px] font-medium text-otto-red">
                  {displayError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password.trim()}
                className={`w-full rounded-xl py-3 text-[14px] font-bold ${
                  !loading && password.trim()
                    ? "bg-otto-green text-black"
                    : "bg-otto-surface text-otto-text-faint"
                }`}
              >
                {loading ? "Unlocking…" : "Unlock vault"}
              </button>
            </form>

            <div className="mt-6 flex gap-3 rounded-xl border border-otto-divider bg-otto-surface px-3.5 py-3">
              <KeyRound className="shrink-0 text-otto-text-dim" size={20} aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-otto-text-dim">
                Wrong password? Try again carefully. Otto cannot reset or recover your master
                password.
              </p>
            </div>
          </>
        )}

        {mode === "unavailable" && (
          <>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Vault unavailable
            </p>
            <h1 className="text-center text-[26px] font-extrabold tracking-[-0.4px]">
              Encrypted sync is not ready
            </h1>
            <p className="mt-2 text-center text-[13.5px] leading-relaxed text-otto-text-dim">
              The encrypted vault needs Supabase auth and the vault schema before you can unlock or
              set up encryption.
            </p>

            <div className="mt-6 rounded-2xl bg-otto-surface px-4 py-4">
              <h2 className="text-[15px] font-bold">What to check</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-otto-text-dim">
                <li>Sign in to Trader Otto with a Supabase account.</li>
                <li>
                  Apply the vault schema in Supabase (
                  <code className="text-[12px] text-otto-text">ov_vaults</code>,{" "}
                  <code className="text-[12px] text-otto-text">ov_items</code>, and related tables).
                </li>
                <li>Confirm your project URL and anon key are configured in the app environment.</li>
                <li>Reload and try again once the backend responds.</li>
              </ol>
            </div>

            {localItemCount > 0 && (
              <p className="mt-4 text-[13px] text-otto-text-dim">
                Local prototype data ({localItemCount}{" "}
                {localItemCount === 1 ? "item" : "items"}) stays in this browser until encrypted
                migration is available.
              </p>
            )}

            {displayError && (
              <p role="alert" className="mt-4 text-[13px] font-medium text-otto-red">
                {displayError}
              </p>
            )}

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-otto-green py-3 text-[14px] font-bold text-black disabled:opacity-60"
              >
                {loading ? "Checking…" : "Try again"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
