"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { parseLeoEvents } from "@/lib/life";
import { parseLeoTasks } from "@/lib/lifeTasks";
import type { LifeInput, LifeTaskInput } from "@/types/life";

export function LifeSettingsScreen({
  readonly,
  notice,
  onFile,
}: {
  readonly: boolean;
  notice: string;
  onFile: (dates: LifeInput[], tasks: LifeTaskInput[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <h1 className="mb-3 text-[22px] font-extrabold tracking-[-0.3px]">Settings</h1>
      <button
        type="button"
        disabled={readonly}
        onClick={() => fileRef.current?.click()}
        className="flex w-full items-center gap-3 rounded-2xl bg-otto-surface px-3.5 py-3 text-left disabled:opacity-40"
      >
        <Upload size={18} className="text-otto-text-dim" />
        <span>
          <b className="block text-[14px]">Import</b>
          <span className="text-[12px] text-otto-text-dim">Leo export of dates and tracked tasks</span>
        </span>
      </button>
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
        Birthdays and anniversaries stay on Dates. Daily habits and weekly counts land on Tasks.
        Nothing is added until you confirm the list.
      </p>
    </div>
  );
}
