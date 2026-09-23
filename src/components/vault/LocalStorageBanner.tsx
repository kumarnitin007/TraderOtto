"use client";

import { AlertTriangle } from "lucide-react";

export function LocalStorageBanner() {
  return (
    <div
      role="alert"
      className="mb-4 flex gap-2.5 rounded-xl border border-otto-amber/35 bg-otto-amber-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-otto-amber"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" strokeWidth={2.2} />
      <div>
        <p className="font-semibold text-otto-text">Local prototype storage only</p>
        <p className="mt-1 text-otto-text-dim">
          Vault data stays in this browser via IndexedDB. It is not encrypted and
          never syncs. Do not store real passwords or secrets here until Supabase
          encryption is ready.
        </p>
      </div>
    </div>
  );
}
