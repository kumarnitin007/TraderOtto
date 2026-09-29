"use client";

import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { RobinhoodCsvImport } from "@/components/positions/RobinhoodCsvImport";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferNotice,
} from "@/components/settings/DataTransferPrimitives";
import { useTrades } from "@/hooks/useTrades";
import { downloadJournalCsv } from "@/lib/journalExport";

export function TradeDataSettings() {
  const { trades } = useTrades();

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
