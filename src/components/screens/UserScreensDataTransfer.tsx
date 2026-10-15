"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileJson, Upload } from "lucide-react";
import {
  DataTransferButton,
  DataTransferCard,
  DataTransferNotice,
} from "@/components/settings/DataTransferPrimitives";
import { SettingsDetailScreen } from "@/components/settings/SettingsPrimitives";
import { screenRowPreview } from "@/lib/userScreensEngine";
import {
  applyScreenImport,
  parseUserScreenJson,
  splitScreenTable,
  suggestScreenImport,
  tableFromSpreadsheet,
  userScreenCsv,
  userScreenJson,
  type ScreenImportAssignment,
} from "@/lib/userScreensTransfer";
import type { UserScreen, UserScreenColumn, UserScreenRow, UserScreenRowData } from "@/types/userScreens";

export function UserScreensDataTransfer({
  lists,
  rows,
  readonly,
  onClose,
  onImportRows,
  onImportScreen,
}: {
  lists: UserScreen[];
  rows: Record<string, UserScreenRow[]>;
  readonly: boolean;
  onClose: () => void;
  onImportRows: (
    list: UserScreen,
    imported: UserScreenRowData[],
    addedColumns: UserScreenColumn[],
  ) => Promise<void>;
  onImportScreen: (backup: ReturnType<typeof parseUserScreenJson>) => Promise<void>;
}) {
  const sheetRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [table, setTable] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [assignments, setAssignments] = useState<ScreenImportAssignment[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const list = lists.find((item) => item.id === listId) ?? null;
  const inspected = useMemo(() => (table ? splitScreenTable(table) : null), [table]);
  const plan = useMemo(() => {
    if (!list || !inspected) return null;
    return applyScreenImport(list, inspected.headers, inspected.body, assignments);
  }, [assignments, inspected, list]);

  function chooseList(nextId: string) {
    setListId(nextId);
    setTable(null);
    setAssignments([]);
    setFileName("");
    setMessage("");
  }

  async function chooseSheet(file?: File) {
    if (!file || !list) return;
    setMessage("");
    try {
      const nextTable = await tableFromSpreadsheet(await file.arrayBuffer(), file.name);
      const next = splitScreenTable(nextTable);
      if (next.headers.filter(Boolean).length < 2) {
        throw new Error("The first row needs the column names from the spreadsheet.");
      }
      setTable(nextTable);
      setFileName(file.name);
      setAssignments(suggestScreenImport(list, next.headers));
    } catch (cause) {
      setTable(null);
      setAssignments([]);
      setMessage(cause instanceof Error ? cause.message : "That file could not be read.");
    }
  }

  function retarget(index: number, value: string) {
    setAssignments((current) => {
      const next = current.map((assignment) => ({ ...assignment }));
      const target = next[index];
      if (!target) return current;
      if (value === "skip") {
        target.kind = "skip";
        target.reason = undefined;
      } else if (value === "add") {
        const existing = new Set(list?.columns.map((column) => column.id));
        target.kind = "add";
        target.columnId =
          target.columnId && !existing.has(target.columnId) ? target.columnId : crypto.randomUUID();
        target.reason = undefined;
      } else {
        const columnId = value.slice(4);
        next.forEach((assignment, assignmentIndex) => {
          if (assignmentIndex !== index && assignment.kind === "column" && assignment.columnId === columnId) {
            assignment.kind = "skip";
            assignment.reason = undefined;
          }
        });
        target.kind = "column";
        target.columnId = columnId;
        target.reason = undefined;
      }
      return next;
    });
  }

  async function confirmRows() {
    if (!list || !plan) return;
    setBusy(true);
    setMessage("");
    try {
      await onImportRows(list, plan.rows, plan.addedColumns);
      onClose();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Import failed.");
      setBusy(false);
    }
  }

  async function chooseJson(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      await onImportScreen(parseUserScreenJson(await file.text()));
      onClose();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Import failed.");
      setBusy(false);
    }
  }

  const samples = list && plan ? plan.rows.slice(0, 3).map((row) => screenRowPreview(listWithAdded(list, plan.addedColumns), row)) : [];

  return (
    <SettingsDetailScreen title="Import & export" eyebrow="User Screens data" onClose={onClose}>
      <div className="space-y-3">
        {message && (
          <p className="rounded-xl bg-otto-red-soft px-3 py-2 text-[12px] text-otto-red">{message}</p>
        )}
        <DataTransferCard
          icon={Upload}
          title="Import rows"
          description="Choose a CSV or Excel file. Dates such as 28-Jan-23 are converted, and columns like Date Out can map onto Start date. Nothing is saved until you confirm."
          tone="accent"
        >
          {!lists.length && (
            <p className="mb-3 text-[12px] text-otto-text-dim">Create a screen before importing rows.</p>
          )}
          <label className="grid gap-1 text-[12px] font-semibold text-otto-text-dim">
            Screen
            <select
              value={listId}
              onChange={(event) => chooseList(event.target.value)}
              className="h-10 rounded-xl border border-otto-divider bg-otto-bg px-3 text-[14px] text-otto-text"
            >
              {lists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {rows[item.id]?.length ?? 0} rows
                </option>
              ))}
            </select>
          </label>
          <input
            ref={sheetRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(event) => {
              void chooseSheet(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="mt-3">
            <DataTransferButton
              variant="secondary"
              disabled={readonly || !list}
              onClick={() => sheetRef.current?.click()}
            >
              {fileName || "Choose CSV or Excel file"}
            </DataTransferButton>
          </div>
          {list && plan && inspected && (
            <div className="mt-4 space-y-3">
              <p className="text-[13px] text-otto-text">
                <b>{plan.rows.length}</b> {plan.rows.length === 1 ? "row" : "rows"} ready
                {plan.blankSkipped > 0 ? ` · ${plan.blankSkipped} blank skipped` : ""}
                {plan.addedColumns.length > 0
                  ? ` · adding ${plan.addedColumns.map((column) => column.label).join(", ")}`
                  : ""}
              </p>
              <div className="space-y-2">
                {assignments.map((assignment, index) => (
                  <label key={`${assignment.header}-${assignment.headerIndex}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 text-[12px]">
                    <span className="truncate font-semibold">{assignment.header || "Blank column"}</span>
                    <select
                      value={assignmentValue(assignment)}
                      onChange={(event) => retarget(index, event.target.value)}
                      className="h-10 min-w-0 rounded-xl border border-otto-divider bg-otto-bg px-2 text-[13px] text-otto-text"
                    >
                      <option value="skip">
                        {assignment.reason === "calculated" ? "Skip · calculated here" : "Skip"}
                      </option>
                      {list.columns
                        .filter((column) => column.type !== "auto")
                        .map((column) => (
                          <option key={column.id} value={`col:${column.id}`}>
                            {column.label}
                          </option>
                        ))}
                      <option value="add">Add as text column</option>
                    </select>
                  </label>
                ))}
              </div>
              {samples.length > 0 && (
                <div className="rounded-xl bg-otto-bg px-3 py-2">
                  {samples.map((sample, index) => (
                    <p key={`${sample.title}-${index}`} className="truncate py-1 text-[12px]">
                      <b>{sample.title}</b>
                      {sample.detail ? ` · ${sample.detail}` : ""}
                      {sample.metric ? ` · ${sample.metric}` : ""}
                    </p>
                  ))}
                </div>
              )}
              {plan.dateProblems.length > 0 && (
                <p className="text-[12px] text-otto-amber">
                  {plan.dateProblems.length} {plan.dateProblems.length === 1 ? "date was" : "dates were"} left blank.
                  {" "}
                  {plan.dateProblems
                    .slice(0, 3)
                    .map((problem) => `Row ${problem.row} ${problem.column} “${problem.value}”`)
                    .join("; ")}
                </p>
              )}
              <DataTransferButton disabled={readonly || busy || plan.rows.length === 0} onClick={() => void confirmRows()}>
                {busy ? "Importing…" : `Import ${plan.rows.length} ${plan.rows.length === 1 ? "row" : "rows"}`}
              </DataTransferButton>
            </div>
          )}
        </DataTransferCard>

        <DataTransferCard
          icon={Download}
          title="Export this screen"
          description="Download the selected screen. CSV includes calculated columns. JSON can recreate the screen."
        >
          <div className="grid grid-cols-2 gap-2">
            <DataTransferButton
              disabled={!list}
              onClick={() => list && download(userScreenCsv(list, rows[list.id] ?? []))}
            >
              Export CSV
            </DataTransferButton>
            <DataTransferButton
              variant="secondary"
              disabled={!list}
              onClick={() => list && download(userScreenJson(list, rows[list.id] ?? []))}
            >
              Export JSON
            </DataTransferButton>
          </div>
        </DataTransferCard>

        <DataTransferCard
          icon={FileJson}
          title="Import a screen backup"
          description="A User Screens JSON file creates another screen, up to the four-screen limit."
        >
          <input
            ref={jsonRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              void chooseJson(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <DataTransferButton variant="secondary" disabled={readonly || lists.length >= 4} onClick={() => jsonRef.current?.click()}>
            Choose JSON file
          </DataTransferButton>
        </DataTransferCard>
        <DataTransferNotice>
          Row files append to the screen you select. A calculated column such as Total days is kept as a formula, not copied from the file.
        </DataTransferNotice>
      </div>
    </SettingsDetailScreen>
  );
}

function assignmentValue(assignment: ScreenImportAssignment) {
  if (assignment.kind === "add") return "add";
  if (assignment.kind === "column" && assignment.columnId) return `col:${assignment.columnId}`;
  return "skip";
}

function listWithAdded(list: UserScreen, added: UserScreenColumn[]): UserScreen {
  return added.length ? { ...list, columns: [...list.columns, ...added] } : list;
}

function download(file: { fileName: string; text: string }) {
  const url = URL.createObjectURL(new Blob([file.text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
