"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
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
      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        <button
          type="button"
          disabled={readonly}
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left disabled:opacity-40"
        >
          <Upload size={18} className="text-otto-text-dim" />
          <span>
            <b className="block text-[14px]">Import</b>
            <span className="text-[12px] text-otto-text-dim">Leo export of dates and habits</span>
          </span>
        </button>
        <div className="mx-3.5 border-t border-otto-divider" />
        <div className="px-3.5 py-3">
          <b className="block text-[14px]">Export</b>
          <span className="text-[12px] text-otto-text-dim">Choose what goes in the file</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {choices.map((choice) => (
              <button
                key={choice.key}
                type="button"
                aria-pressed={exportOptions[choice.key]}
                onClick={() =>
                  setExportOptions((current) => ({
                    ...current,
                    [choice.key]: !current[choice.key],
                  }))
                }
                className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
                  exportOptions[choice.key]
                    ? "bg-otto-text text-otto-bg"
                    : "bg-otto-bg text-otto-text-dim"
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selected}
              onClick={() => onExport("json", exportOptions)}
              className="flex items-center gap-2 rounded-full bg-otto-bg px-4 py-2 text-[13px] font-bold disabled:opacity-40"
            >
              <Download size={15} />
              Export JSON
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => onExport("csv", exportOptions)}
              className="flex items-center gap-2 rounded-full bg-otto-bg px-4 py-2 text-[13px] font-bold disabled:opacity-40"
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void file.text().then((text) => onFile(parseLeoEvents(text), parseLeoTasks(text)));
        }}
      />
      {notice && <p className="mt-3 text-[13px] text-otto-text-dim">{notice}</p>}
      <p className="mt-4 text-[13px] text-otto-text-dim">
        Birthdays and anniversaries stay on Dates. Recurring items land on Habits. One-off items
        belong in To-dos. A to-do shows on Today once it has a due date. Nothing is added until
        you confirm the list.
      </p>
    </div>
  );
}
