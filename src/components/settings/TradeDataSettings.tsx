"use client";

import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { RobinhoodCsvImport } from "@/components/positions/RobinhoodCsvImport";
import { useTrades } from "@/hooks/useTrades";
import { downloadJournalCsv } from "@/lib/journalExport";

export function TradeDataSettings() {
  const { trades } = useTrades();

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-otto-surface p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-otto-green-soft text-otto-green">
            <FileSpreadsheet size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold">Import Robinhood activity</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
              Select a Robinhood account activity CSV. Otto reconstructs option
              positions locally and shows a dry run before anything is saved.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <RobinhoodCsvImport />
        </div>
      </section>

      <section className="rounded-2xl bg-otto-surface p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-otto-surface-raise text-otto-text-dim">
            <Download size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">Export trade journal</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-otto-text-faint">
              Download all {trades.length} saved trade{trades.length === 1 ? "" : "s"}
              , including strikes, premiums, fees, P/L, greeks, and notes.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!trades.length}
          onClick={() => downloadJournalCsv(trades)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-otto-text py-2.5 text-xs font-bold text-otto-bg disabled:opacity-40"
        >
          <Download size={14} />
          Export complete journal CSV
        </button>
      </section>

      <div className="flex items-start gap-2 rounded-2xl border border-otto-divider px-4 py-3 text-[11px] leading-relaxed text-otto-text-faint">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-otto-green" />
        CSV files are read in this browser. Imports are saved only after your review;
        exports are created directly on this device.
      </div>
    </div>
  );
}
