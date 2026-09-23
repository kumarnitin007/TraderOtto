"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Lock, Timer } from "lucide-react";

const MIN_MASTER_LENGTH = 14;
const AUTO_LOCK_OPTIONS = [1, 5, 15, 30] as const;

const inputClassName =
  "w-full rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[15px]";

export type VaultSecuritySettingsProps = {
  autoLockMinutes: number;
  onAutoLockChange: (minutes: number) => void;
  onLock: () => void;
  onChangePassword: (currentPassword: string, nextPassword: string) => void;
  busy?: boolean;
  error?: string | null;
};

function nextStrengthHint(password: string): { label: string; ok: boolean } {
  if (password.length === 0) {
    return { label: `At least ${MIN_MASTER_LENGTH} characters`, ok: false };
  }
  if (password.length < MIN_MASTER_LENGTH) {
    return {
      label: `${MIN_MASTER_LENGTH - password.length} more needed`,
      ok: false,
    };
  }
  if (/\s/.test(password) && password.split(/\s+/).filter(Boolean).length >= 3) {
    return { label: "Strong passphrase", ok: true };
  }
  return { label: "Meets minimum", ok: true };
}

function SecretInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
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

export function VaultSecuritySettings({
  autoLockMinutes,
  onAutoLockChange,
  onLock,
  onChangePassword,
  busy = false,
  error = null,
}: VaultSecuritySettingsProps) {
  const formId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy && !error) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setLocalError(null);
    }
  }, [busy, error]);

  const nextHint = useMemo(() => nextStrengthHint(next), [next]);
  const displayError = localError ?? error;

  function clearSecrets() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!current.trim()) {
      setLocalError("Enter your current master password.");
      return;
    }
    if (!nextHint.ok) {
      setLocalError(`New password must be at least ${MIN_MASTER_LENGTH} characters.`);
      return;
    }
    if (next !== confirm) {
      setLocalError("New passwords do not match.");
      return;
    }
    if (current === next) {
      setLocalError("Choose a different password from your current one.");
      return;
    }
    const currentPassword = current;
    const nextPassword = next;
    clearSecrets();
    onChangePassword(currentPassword, nextPassword);
  }

  return (
    <section className="mx-auto w-full max-w-[720px] px-[18px] py-4 pb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Vault security
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Master password & lock</h1>
      <p className="mt-0.5 text-[13.5px] text-otto-text-dim">
        Control auto-lock and update the password that wraps your vault key.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
        <div className="flex items-center gap-3 px-3.5 py-3">
          <Timer size={18} className="shrink-0 text-otto-text-dim" aria-hidden />
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[14px] font-medium">Auto-lock</span>
            <span className="text-[12px] text-otto-text-faint">
              Lock the vault after inactivity on this device
            </span>
          </label>
          <select
            value={autoLockMinutes}
            onChange={(event) => onAutoLockChange(Number(event.target.value))}
            disabled={busy}
            className="rounded-[10px] border border-otto-divider bg-otto-bg px-2 py-1.5 text-[13px] font-semibold"
            aria-label="Auto-lock after inactivity"
          >
            {AUTO_LOCK_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </div>
        <div className="mx-3.5 border-t border-otto-divider" />
        <button
          type="button"
          onClick={onLock}
          disabled={busy}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-otto-surface-raise disabled:opacity-60"
        >
          <Lock size={18} className="shrink-0 text-otto-text-dim" aria-hidden />
          <span className="flex-1 text-[14px] font-medium">Lock now</span>
        </button>
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-bold">Change master password</h2>
      <p className="mb-4 text-[13px] leading-relaxed text-otto-text-dim">
        Otto re-wraps your vault key with the new password. Items stay encrypted with the same vault
        key; only the wrapping changes. There is no recovery if you forget the new password.
      </p>

      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4" aria-busy={busy}>
        <SecretInput
          id={`${formId}-current`}
          label="Current master password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <SecretInput
          id={`${formId}-next`}
          label="New master password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
        />
        <p className="text-[12px] text-otto-text-dim" aria-live="polite">
          {nextHint.label}. Prefer a long passphrase (min {MIN_MASTER_LENGTH} characters).
        </p>
        <SecretInput
          id={`${formId}-confirm`}
          label="Confirm new master password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />

        <div className="flex gap-2 rounded-xl border border-otto-amber/35 bg-otto-amber-soft px-3.5 py-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-otto-amber" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-otto-text-dim">
            Changing your master password does not create a backup. Store the new password safely;
            Otto cannot reset it for you.
          </p>
        </div>

        {displayError && (
          <p role="alert" className="text-[13px] font-medium text-otto-red">
            {displayError}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !current.trim() || !nextHint.ok || !confirm || next !== confirm}
          className={`w-full rounded-xl py-3 text-[14px] font-bold ${
            !busy && current.trim() && nextHint.ok && confirm && next === confirm
              ? "bg-otto-green text-black"
              : "bg-otto-surface text-otto-text-faint"
          }`}
        >
          {busy ? "Updating password…" : "Update master password"}
        </button>
      </form>
    </section>
  );
}
