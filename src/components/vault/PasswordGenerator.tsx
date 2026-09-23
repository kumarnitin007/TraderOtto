"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, WandSparkles, X } from "lucide-react";

function generatePassword(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const random = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(random, (value) => chars[value % chars.length]).join("");
}

function strengthLabel(length: number) {
  if (length >= 20) return "Very strong";
  if (length >= 14) return "Strong";
  if (length >= 10) return "Good";
  return "Fair";
}

export function PasswordGenerator({
  onClose,
  onCopy,
}: {
  onClose: () => void;
  onCopy: (value: string, label?: string) => void;
}) {
  const [length, setLength] = useState(18);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword(generatePassword(length));
  }, [length]);

  const strengthBars = useMemo(() => {
    const filled =
      length >= 20 ? 4 : length >= 16 ? 3 : length >= 12 ? 2 : 1;
    return filled;
  }, [length]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-otto-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-otto-divider px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <b className="text-[15px] font-bold">Password generator</b>
        <span className="w-9" />
      </header>

      <div className="mx-auto w-full max-w-[720px] flex-1 px-[18px] py-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-otto-green-soft text-otto-green">
          <WandSparkles size={28} />
        </div>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
          Strong & unique
        </p>
        <h1 className="mb-5 text-center text-[24px] font-extrabold">A fresh password</h1>

        <div className="mb-5 flex items-center gap-2 rounded-xl bg-otto-surface px-3 py-3">
          <strong className="flex-1 break-all text-[15px] font-semibold">{password}</strong>
          <button
            type="button"
            onClick={() => setPassword(generatePassword(length))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-bg"
            aria-label="Regenerate"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <label className="mb-2 flex justify-between text-[13px] font-semibold">
          <span>Length</span>
          <b>{length} characters</b>
        </label>
        <input
          type="range"
          min={10}
          max={32}
          value={length}
          onChange={(event) => setLength(Number(event.target.value))}
          className="mb-4 w-full accent-otto-green"
        />

        <div className="mb-6 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${
                index < strengthBars ? "bg-otto-green" : "bg-otto-divider"
              }`}
            />
          ))}
          <b className="ml-2 text-[12px] text-otto-text-dim">{strengthLabel(length)}</b>
        </div>

        <button
          type="button"
          onClick={() => onCopy(password, "Password copied")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-otto-green py-3 text-[14px] font-bold text-black"
        >
          <Copy size={18} />
          Copy password
        </button>
      </div>
    </div>
  );
}
