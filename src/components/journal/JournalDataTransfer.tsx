"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferNotice,
  DataTransferRow,
} from "@/components/settings/DataTransferPrimitives";
import { SettingsDetailScreen } from "@/components/settings/SettingsPrimitives";
import {
  newWritingEntries,
  parseWritingBackup,
  writingExportCsv,
  writingExportJson,
} from "@/lib/writingTransfer";
import type { JournalEntry, JournalInput } from "@/types/journal";

export function JournalDataTransfer({
  entries,
  readonly,
  onImport,
}: {
  entries: JournalEntry[];
  readonly: boolean;
  onImport: (entries: JournalInput[]) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [incoming, setIncoming] = useState<JournalInput[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function download(format: "json" | "csv") {
    const text = format === "csv" ? writingExportCsv(entries) : writingExportJson(entries);
    const blob = new Blob([text], {
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `otto-journal-${new Date().toISOString().slice(0, 10)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function confirm() {
    if (!incoming?.length) return;
    setSaving(true);
    setError("");
    try {
      await onImport(incoming);
      setIncoming(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import those entries.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
        <DataTransferRow
          detail={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          onClick={() => setOpen(true)}
        />
      </div>
      {open && (
        <SettingsDetailScreen
          title="Import & export"
          eyebrow="Journal data"
          onClose={() => setOpen(false)}
        >
          <div className="space-y-3">
            <DataTransferCard
              icon={Upload}
              title="Import journal"
              description="Choose an Otto Journal JSON backup. Entries that are already saved are skipped."
              tone="accent"
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setError("");
                  void file.text().then((text) => {
                    try {
                      const parsed = parseWritingBackup(text);
                      const fresh = newWritingEntries(entries, parsed);
                      setIncoming(fresh);
                      if (!fresh.length) setError("Every entry in that file is already in the journal.");
                    } catch (cause) {
                      setIncoming(null);
                      setError(cause instanceof Error ? cause.message : "Could not read that file.");
                    }
                  });
                }}
              />
              <DataTransferButton
                variant="secondary"
                disabled={readonly}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} />
                Choose JSON
              </DataTransferButton>
              {incoming && incoming.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-[11.5px] text-otto-text-dim">
                    {incoming.length} new entr{incoming.length === 1 ? "y" : "ies"} ready to add.
                  </p>
                  <DataTransferButton disabled={saving} onClick={() => void confirm()}>
                    {saving ? "Importing…" : `Add ${incoming.length} entr${incoming.length === 1 ? "y" : "ies"}`}
                  </DataTransferButton>
                </div>
              )}
              {error && <p className="mt-2 text-xs font-semibold text-otto-red">{error}</p>}
            </DataTransferCard>
            <DataTransferCard
              icon={Download}
              title="Export journal"
              description={`${entries.length} saved entr${entries.length === 1 ? "y" : "ies"}. JSON can be imported back. CSV is for a spreadsheet.`}
            >
              <div className="grid grid-cols-2 gap-2">
                <DataTransferButton disabled={!entries.length} onClick={() => download("json")}>
                  <Download size={14} />
                  Export JSON
                </DataTransferButton>
                <DataTransferButton
                  variant="secondary"
                  disabled={!entries.length}
                  onClick={() => download("csv")}
                >
                  <Download size={14} />
                  Export CSV
                </DataTransferButton>
              </div>
            </DataTransferCard>
            <DataTransferNotice>
              Nothing is added until you confirm the preview. Exports are created on this device.
            </DataTransferNotice>
          </div>
        </SettingsDetailScreen>
      )}
    </>
  );
}
