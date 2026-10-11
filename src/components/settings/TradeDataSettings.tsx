"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, History, ShieldCheck, Trash2 } from "lucide-react";
import { RobinhoodCsvImport } from "@/components/positions/RobinhoodCsvImport";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferNotice,
} from "@/components/settings/DataTransferPrimitives";
import { useAuth } from "@/hooks/useAuth";
import { useTrades } from "@/hooks/useTrades";
import { downloadJournalCsv } from "@/lib/journalExport";
import {
  canUndoImport,
  markTradeImportUndone,
  readTradeImportHistory,
  type TradeImportRecord,
} from "@/lib/tradeImportHistory";

export function TradeDataSettings() {
  const { trades, deleteAllTrades, readonly, loading } = useTrades();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function clearTrades() {
    if (!confirming) {
      setConfirming(true);
      setError("");
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await deleteAllTrades();
      setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete trades.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <DataTransferCard
        icon={FileSpreadsheet}
        title="Import Robinhood activity"
        description="Select a Robinhood account activity CSV. Otto reconstructs option positions locally and shows a dry run before anything is saved."
        tone="accent"
      >
        <RobinhoodCsvImport />
      </DataTransferCard>

      <TradeImportHistoryCard />

      <DataTransferCard
        icon={Download}
        title="Export trade journal"
        description={
          <>
            Download all {trades.length} saved trade{trades.length === 1 ? "" : "s"},
            including strikes, premiums, fees, P/L, greeks, and notes.
          </>
        }
      >
        <DataTransferButton
          disabled={!trades.length}
          onClick={() => downloadJournalCsv(trades)}
        >
          <Download size={14} />
          Export complete journal CSV
        </DataTransferButton>
      </DataTransferCard>

      <DataTransferCard
        icon={Trash2}
        title="Delete all trades"
        description={
          trades.length
            ? `Permanently removes all ${trades.length} open and closed trades in this account. Banks, vault, and journal notes stay. Export the journal first if you want a copy before reloading Robinhood files.`
            : "No saved trades to remove."
        }
      >
        <DataTransferButton
          variant={confirming ? "danger" : "secondary"}
          disabled={!trades.length || readonly || loading || deleting}
          onClick={() => void clearTrades()}
        >
          <Trash2 size={14} />
          {deleting
            ? "Deleting trades…"
            : confirming
              ? `Delete ${trades.length} trades now`
              : "Delete all trades"}
        </DataTransferButton>
        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="mt-2 w-full py-2 text-xs font-semibold text-otto-text-faint"
          >
            Cancel
          </button>
        )}
        {error && (
          <div className="mt-2 text-xs font-semibold text-otto-red">{error}</div>
        )}
      </DataTransferCard>

      <DataTransferNotice>
        <span className="flex items-start gap-2">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-otto-green" />
          CSV files are read in this browser. Imports are saved only after your review.
          The newest import can be undone. Exports are created on this device.
        </span>
      </DataTransferNotice>
    </div>
  );
}

function TradeImportHistoryCard() {
  const { user } = useAuth();
  const { rollbackImport, readonly } = useTrades();
  const [records, setRecords] = useState<TradeImportRecord[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.id === "local-bypass") {
      setRecords([]);
      return;
    }
    const load = () => setRecords(readTradeImportHistory(user.id));
    load();
    window.addEventListener("otto-trade-imports", load);
    return () => window.removeEventListener("otto-trade-imports", load);
  }, [user]);

  async function undo(record: TradeImportRecord) {
    if (!user || !canUndoImport(records, record.id)) return;
    if (!confirming) {
      setConfirming(true);
      setError("");
      return;
    }
    setUndoing(true);
    setError("");
    try {
      await rollbackImport({
        createdIds: record.createdIds,
        before: record.before,
        removed: record.removed,
      });
      markTradeImportUndone(user.id, record.id);
      setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not undo that import.");
    } finally {
      setUndoing(false);
    }
  }

  return (
    <DataTransferCard
      icon={History}
      title="Recent imports"
      description="Each Robinhood file stays with your account, including rows Otto could not turn into a trade. Undo puts the newest import back the way it was."
    >
      {records.length === 0 ? (
        <p className="text-[11.5px] text-otto-text-faint">No Robinhood imports yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-otto-divider">
          {records.map((record) => {
            const open = openId === record.id;
            const when = new Date(record.at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <div key={record.id} className="border-b border-otto-divider last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(open ? null : record.id);
                    setConfirming(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{record.fileName}</span>
                    <span className="text-[11px] text-otto-text-faint">
                      {when} · {record.imported} new · {record.updated} updated
                      {record.undone ? " · undone" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-otto-text-dim">
                    {record.unmatched.length
                      ? `${record.unmatched.length} unmatched`
                      : "Matched"}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-otto-divider px-3 py-3">
                    {record.unmatched.length > 0 ? (
                      <div className="max-h-36 overflow-y-auto text-[11px] leading-relaxed text-otto-text-faint">
                        {record.unmatched.map((row) => (
                          <div key={`${record.id}-${row.row}-${row.code}-${row.description}`}>
                            Row {row.row} · {row.code} · {row.description}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-otto-text-faint">
                        Every option row in this file was matched or skipped as a duplicate.
                      </p>
                    )}
                    {canUndoImport(records, record.id) && (
                      <div className="mt-3">
                        <DataTransferButton
                          variant={confirming ? "danger" : "secondary"}
                          disabled={readonly || undoing}
                          onClick={() => void undo(record)}
                        >
                          {undoing
                            ? "Undoing import…"
                            : confirming
                              ? "Undo this import now"
                              : "Undo this import"}
                        </DataTransferButton>
                        {confirming && (
                          <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="mt-2 w-full py-2 text-xs font-semibold text-otto-text-faint"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                    {error && open && (
                      <div className="mt-2 text-xs font-semibold text-otto-red">{error}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DataTransferCard>
  );
}
