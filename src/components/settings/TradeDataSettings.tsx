"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, ShieldCheck, Trash2 } from "lucide-react";
import { RobinhoodCsvImport } from "@/components/positions/RobinhoodCsvImport";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferNotice,
} from "@/components/settings/DataTransferPrimitives";
import { useTrades } from "@/hooks/useTrades";
import { downloadJournalCsv } from "@/lib/journalExport";

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
          CSV files are read in this browser. Imports are saved only after your review;
          exports are created directly on this device.
        </span>
      </DataTransferNotice>
    </div>
  );
}
