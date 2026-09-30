"use client";

import { useRef, useState } from "react";
import { Download, Import, Upload } from "lucide-react";
import { SectionPreferences } from "@/components/settings/SectionPreferences";
import { SettingsDetailScreen, SettingsRow } from "@/components/settings/SettingsPrimitives";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferChip,
  DataTransferNotice,
} from "@/components/settings/DataTransferPrimitives";
import { parseLeoEvents } from "@/lib/life";
import { parseLeoTasks } from "@/lib/lifeTasks";
import {
  DEFAULT_LIFE_EXPORT_OPTIONS,
  type LifeExportOptions,
} from "@/lib/lifeTransfer";
import type { LifeInput, LifeTaskInput } from "@/types/life";

export function LifeSettingsScreen({
  readonly,
  notice,
  onFile,
  onExport,
}: {
  readonly: boolean;
  notice: string;
  onFile: (dates: LifeInput[], tasks: LifeTaskInput[]) => void;
  onExport: (format: "json" | "csv", options: LifeExportOptions) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<LifeExportOptions>(
    DEFAULT_LIFE_EXPORT_OPTIONS
  );
  const choices: { key: keyof LifeExportOptions; label: string }[] = [
    { key: "dates", label: "Dates" },
    { key: "habits", label: "Habits" },
    { key: "habitHistory", label: "Habit history" },
    { key: "todos", label: "To-dos" },
  ];
  const selected = choices.filter((choice) => exportOptions[choice.key]).length;

  return (
    <div>
      <h1 className="mb-3 text-[22px] font-extrabold tracking-[-0.3px]">Settings</h1>
      <SectionPreferences />
      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={Import}
          label="Import & export"
          detail="Leo CSV or backup"
          onClick={() => setTransferOpen(true)}
        />
      </div>
      {notice && <p className="mt-3 text-[13px] text-otto-text-dim">{notice}</p>}
      <p className="mt-4 text-[13px] text-otto-text-dim">
        Birthdays and anniversaries stay on Dates. Recurring items land on Habits. One-off items
        belong in To-dos. A to-do shows on Today once it has a due date. Nothing is added until
        you confirm the list.
      </p>
      {transferOpen && (
        <SettingsDetailScreen title="Import & export" eyebrow="Life data" onClose={() => setTransferOpen(false)}>
          <div className="space-y-3">
        <DataTransferCard
          icon={Upload}
          title="Import from Leo"
          description="Choose a Leo CSV export. Dates and recurring habits are parsed locally and shown for confirmation."
          tone="accent"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then((text) => {
                onFile(parseLeoEvents(text), parseLeoTasks(text));
                setTransferOpen(false);
              });
            }}
          />
          <DataTransferButton
            variant="secondary"
          disabled={readonly}
          onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} />
            Choose CSV file
          </DataTransferButton>
        </DataTransferCard>

        <DataTransferCard
          icon={Download}
          title="Export Life data"
          description="Choose what to include, then download JSON for backup or CSV for a spreadsheet."
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-otto-text-faint">
            Include
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map((choice) => (
              <DataTransferChip
                key={choice.key}
                label={choice.label}
                active={exportOptions[choice.key]}
                onClick={() =>
                  setExportOptions((current) => ({
                    ...current,
                    [choice.key]: !current[choice.key],
                  }))
                }
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <DataTransferButton
              disabled={!selected}
              onClick={() => onExport("json", exportOptions)}
            >
              <Download size={14} />
              Export JSON
            </DataTransferButton>
            <DataTransferButton
              disabled={!selected}
              onClick={() => onExport("csv", exportOptions)}
            >
              <Download size={14} />
              Export CSV
            </DataTransferButton>
          </div>
        </DataTransferCard>
        <DataTransferNotice>
          Nothing is imported until you confirm the preview. Exports are created directly on
          this device.
        </DataTransferNotice>
          </div>
        </SettingsDetailScreen>
      )}
    </div>
  );
}
