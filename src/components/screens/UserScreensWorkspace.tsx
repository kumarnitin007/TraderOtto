"use client";

import { useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FileJson,
  Grid2X2,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { UserScreensBottomNav } from "@/components/screens/UserScreensBottomNav";
import { OttoPreferencesEntry } from "@/components/settings/OttoPreferences";
import { DataTransferButton } from "@/components/settings/DataTransferPrimitives";
import { SettingsPageHeader } from "@/components/settings/SettingsPrimitives";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useUserScreens } from "@/hooks/useUserScreens";
import { evalRow, userScreenAnalytics } from "@/lib/userScreensEngine";
import {
  USER_SCREEN_TEMPLATES,
  blankScreenTemplate,
  validateUserScreen,
} from "@/lib/userScreensTemplates";
import {
  parseUserScreenCsv,
  parseUserScreenJson,
  userScreenCsv,
  userScreenJson,
} from "@/lib/userScreensTransfer";
import type {
  UserScreen,
  UserScreenColumn,
  UserScreenInput,
  UserScreenRow,
  UserScreenRowData,
} from "@/types/userScreens";

type BuilderState = { mode: "new"; draft: UserScreenInput } | { mode: "edit"; list: UserScreen; draft: UserScreenInput };

export function UserScreensWorkspace() {
  const data = useUserScreens();
  const [tab, setTab] = useScreenOption("screensTab");
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lists = data.lists;
  const active =
    tab === "overview" || tab === "new" || tab === "settings" || lists.some((list) => list.id === tab)
      ? tab
      : "overview";
  const list = lists.find((item) => item.id === active);

  async function saveBuilder(input: UserScreenInput) {
    setBusy(true);
    try {
      const saved =
        builder?.mode === "edit"
          ? await data.updateList(builder.list.id, input)
          : await data.createList(input);
      setBuilder(null);
      setTab(saved.id);
      setNotice(builder?.mode === "edit" ? "Screen updated." : "Screen created.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The screen could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (builder) {
    return (
      <ScreenBuilder
        state={builder}
        rowCount={builder.mode === "edit" ? (data.rows[builder.list.id] ?? []).length : 0}
        busy={busy}
        onCancel={() => setBuilder(null)}
        onSave={saveBuilder}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[760px] pb-28">
      {data.error && <Notice text={data.error} tone="error" />}
      {notice && <Notice text={notice} />}
      {data.loading ? (
        <p className="py-12 text-center text-sm text-otto-text-dim">Loading User Screens…</p>
      ) : active === "overview" ? (
        <ScreensOverview
          lists={lists}
          rows={data.rows}
          readonly={data.readonly}
          onOpen={setTab}
          onNew={() => setTab("new")}
        />
      ) : active === "new" ? (
        <TemplatePicker
          disabled={data.readonly}
          onPick={(draft) => setBuilder({ mode: "new", draft })}
        />
      ) : active === "settings" ? (
        <ScreensSettings
          lists={lists}
          rows={data.rows}
          readonly={data.readonly}
          onEdit={(item) =>
            setBuilder({
              mode: "edit",
              list: item,
              draft: {
                name: item.name,
                columns: item.columns.map((column) => ({ ...column })),
                summary: item.summary ? { ...item.summary } : null,
              },
            })
          }
          onImport={async (backup) => {
            setBusy(true);
            try {
              const saved = await data.createList(
                { name: backup.name, columns: backup.columns, summary: backup.summary },
                backup.rows,
              );
              setTab(saved.id);
              setNotice(`Imported ${backup.rows.length} rows.`);
            } catch (cause) {
              setNotice(cause instanceof Error ? cause.message : "Import failed.");
            } finally {
              setBusy(false);
            }
          }}
          onDelete={async (id) => {
            await data.deleteList(id);
            setTab("overview");
            setNotice("Screen deleted.");
          }}
        />
      ) : list ? (
        <ScreenRows
          list={list}
          rows={data.rows[list.id] ?? []}
          readonly={data.readonly}
          onEditColumns={() =>
            setBuilder({
              mode: "edit",
              list,
              draft: {
                name: list.name,
                columns: list.columns.map((column) => ({ ...column })),
                summary: list.summary ? { ...list.summary } : null,
              },
            })
          }
          onAdd={() => data.addRows(list.id, [{}])}
          onLocal={(rowId, row) => data.setRowLocal(list.id, rowId, row)}
          onSave={(rowId, row) => data.updateRow(list.id, rowId, row)}
          onDelete={(rowId) => data.deleteRow(list.id, rowId)}
          onImport={async (rows, ignored) => {
            await data.addRows(list.id, rows);
            setNotice(`Added ${rows.length} rows${ignored ? ` · ignored ${ignored} unmatched columns` : ""}.`);
          }}
        />
      ) : null}
      <UserScreensBottomNav lists={lists} active={active} onTab={setTab} />
    </div>
  );
}

function ScreensOverview({
  lists,
  rows,
  readonly,
  onOpen,
  onNew,
}: {
  lists: UserScreen[];
  rows: Record<string, UserScreenRow[]>;
  readonly: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const totalRows = lists.reduce((sum, list) => sum + (rows[list.id]?.length ?? 0), 0);
  const invalid = lists.reduce(
    (sum, list) => sum + userScreenAnalytics(list, rows[list.id] ?? []).skipped,
    0,
  );
  return (
    <>
      <div className="mb-5">
        <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">User Screens</h1>
        <p className="text-[13px] text-otto-text-dim">Your own trackers, formulas, and summaries</p>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Metric label="Screens" value={`${lists.length}/4`} />
        <Metric label="Rows" value={String(totalRows)} />
        <Metric label="Not counted" value={String(invalid)} warning={invalid > 0} />
      </div>
      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        {lists.map((list) => {
          const analytics = userScreenAnalytics(list, rows[list.id] ?? []);
          const max = Math.max(1, ...analytics.totals.map((item) => item.value));
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => onOpen(list.id)}
              className="block w-full border-b border-otto-divider px-4 py-4 text-left last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate text-[17px] font-extrabold">{list.name}</h2>
                <span className="shrink-0 text-[12px] text-otto-text-dim">
                  {analytics.rows} {analytics.rows === 1 ? "row" : "rows"}
                </span>
              </div>
              {analytics.totals.slice(0, 4).map((item) => (
                <div key={item.label} className="mt-2 grid grid-cols-[80px_1fr_54px] items-center gap-2 text-[12px]">
                  <span className="truncate text-otto-text-dim">{item.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-otto-divider">
                    <span
                      className="block h-full rounded-full bg-otto-green"
                      style={{ width: `${(item.value / max) * 100}%` }}
                    />
                  </span>
                  <strong className="text-right">{formatNumber(item.value)}</strong>
                </div>
              ))}
              {analytics.skipped > 0 && (
                <span className="mt-3 inline-flex rounded-full bg-otto-red-soft px-2.5 py-1 text-[11px] font-semibold text-otto-red">
                  {analytics.skipped} not counted
                </span>
              )}
            </button>
          );
        })}
        {!lists.length && (
          <div className="px-5 py-12 text-center">
            <Grid2X2 className="mx-auto text-otto-text-faint" />
            <h2 className="mt-3 font-extrabold">Build your first screen</h2>
            <p className="mt-1 text-sm text-otto-text-dim">
              Start with Travel, Expenses, or a blank layout.
            </p>
          </div>
        )}
      </div>
      {lists.length < 4 && (
        <button
          type="button"
          disabled={readonly}
          onClick={onNew}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-otto-green font-bold text-otto-green disabled:opacity-40"
        >
          <Plus size={18} /> New screen
        </button>
      )}
    </>
  );
}

function TemplatePicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (input: UserScreenInput) => void;
}) {
  return (
    <>
      <div className="mb-5">
        <h1 className="text-[26px] font-extrabold">New screen</h1>
        <p className="text-[13px] text-otto-text-dim">Choose a starting point. Every detail can be changed.</p>
      </div>
      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        {USER_SCREEN_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(template.create())}
            className="flex min-h-16 w-full items-center gap-3 border-b border-otto-divider px-4 py-3 text-left last:border-b-0 disabled:opacity-40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-otto-green-soft text-otto-green">
              <Grid2X2 size={19} />
            </span>
            <span>
              <strong className="block text-[15px]">{template.label}</strong>
              <span className="text-[12px] text-otto-text-dim">{template.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function ScreenRows({
  list,
  rows,
  readonly,
  onEditColumns,
  onAdd,
  onLocal,
  onSave,
  onDelete,
  onImport,
}: {
  list: UserScreen;
  rows: UserScreenRow[];
  readonly: boolean;
  onEditColumns: () => void;
  onAdd: () => Promise<unknown>;
  onLocal: (rowId: string, row: UserScreenRowData) => void;
  onSave: (rowId: string, row: UserScreenRowData) => Promise<unknown>;
  onDelete: (rowId: string) => Promise<void>;
  onImport: (rows: UserScreenRowData[], ignored: number) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [transfer, setTransfer] = useState(false);
  const pageSize = rows.length > 200 ? 100 : Math.max(1, rows.length);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const analytics = useMemo(() => userScreenAnalytics(list, rows), [list, rows]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function importCsv(file?: File) {
    if (!file) return;
    const parsed = parseUserScreenCsv(list, await file.text());
    await onImport(parsed.rows, parsed.ignoredHeaders);
  }

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold">{list.name}</h1>
          <p className="text-[12px] text-otto-text-dim">
            {rows.length} rows · {analytics.completionPct}% counted
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEditColumns} className="rounded-full border border-otto-divider px-3 py-2 text-[12px] font-bold">
            Edit columns
          </button>
          <button type="button" onClick={() => setTransfer((value) => !value)} className="rounded-full border border-otto-divider px-3 py-2 text-[12px] font-bold">
            Import / export
          </button>
        </div>
      </div>
      {transfer && (
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-otto-surface p-3">
          <DataTransferButton onClick={() => download(userScreenJson(list, rows))}>Export JSON</DataTransferButton>
          <DataTransferButton onClick={() => download(userScreenCsv(list, rows))}>Export CSV</DataTransferButton>
          <DataTransferButton onClick={() => inputRef.current?.click()} disabled={readonly}>Import CSV</DataTransferButton>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => void importCsv(event.target.files?.[0])} />
        </div>
      )}
      <div className="space-y-2">
        {visible.map((row) => (
          <ScreenRowEditor
            key={row.id}
            list={list}
            row={row}
            readonly={readonly}
            onLocal={(next) => onLocal(row.id, next)}
            onSave={(next) => onSave(row.id, next)}
            onDelete={() => onDelete(row.id)}
          />
        ))}
      </div>
      {!rows.length && (
        <div className="rounded-2xl bg-otto-surface px-5 py-10 text-center text-sm text-otto-text-dim">
          No rows yet. Add the first one below.
        </div>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-otto-surface p-2 text-[12px]">
          <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="px-3 py-2 disabled:opacity-30">Previous</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="px-3 py-2 disabled:opacity-30">Next</button>
        </div>
      )}
      <button
        type="button"
        disabled={readonly || rows.length >= 5000}
        onClick={() => void onAdd()}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-otto-green font-bold text-otto-green disabled:opacity-40"
      >
        <Plus size={17} /> Add row
      </button>
      {list.summary && (
        <div className="sticky bottom-[76px] z-10 mt-4 rounded-2xl border border-otto-divider bg-otto-bg/95 p-3 shadow-lg backdrop-blur desk:bottom-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {analytics.totals.map((item) => (
              <span key={item.label}><b>{item.label}</b> {formatNumber(item.value)}</span>
            ))}
            {analytics.skipped > 0 && <span className="font-semibold text-otto-red">{analytics.skipped} not counted</span>}
          </div>
        </div>
      )}
    </>
  );
}

function ScreenRowEditor({
  list,
  row,
  readonly,
  onLocal,
  onSave,
  onDelete,
}: {
  list: UserScreen;
  row: UserScreenRow;
  readonly: boolean;
  onLocal: (data: UserScreenRowData) => void;
  onSave: (data: UserScreenRowData) => Promise<unknown>;
  onDelete: () => Promise<void>;
}) {
  const evaluation = evalRow(list, row.data);
  const change = (column: UserScreenColumn, value: string | boolean) => {
    onLocal({ ...row.data, [column.id]: value });
  };
  return (
    <div className={`relative rounded-2xl bg-otto-surface px-3 py-3 ${evaluation.err ? "border-l-4 border-otto-red" : ""}`}>
      <button
        type="button"
        disabled={readonly}
        onClick={() => void onDelete()}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center text-otto-text-faint disabled:opacity-30"
        aria-label="Delete row"
      >
        <Trash2 size={15} />
      </button>
      <div className="grid grid-cols-2 gap-2 pr-7">
        {list.columns.map((column) => {
          const result = evaluation.vals[column.id];
          if (column.type === "auto") {
            return (
              <label key={column.id} className="grid gap-1 text-[11px] font-semibold text-otto-text-dim">
                {column.label}
                <span className="min-h-10 rounded-xl bg-otto-bg px-3 py-2 text-[15px] text-otto-text">
                  {result && "v" in result ? formatNumber(result.v) : "—"}
                </span>
              </label>
            );
          }
          if (column.type === "check") {
            return (
              <label key={column.id} className="flex min-h-14 items-center gap-2 rounded-xl bg-otto-bg px-3 text-[12px] font-semibold">
                <input
                  type="checkbox"
                  checked={row.data[column.id] === true}
                  disabled={readonly}
                  onChange={(event) => {
                    const next = { ...row.data, [column.id]: event.target.checked };
                    onLocal(next);
                    void onSave(next);
                  }}
                  className="h-5 w-5"
                />
                {column.label}
              </label>
            );
          }
          return (
            <label key={column.id} className="grid gap-1 text-[11px] font-semibold text-otto-text-dim">
              {column.label}
              <input
                type={column.type}
                inputMode={column.type === "number" ? "decimal" : undefined}
                value={String(row.data[column.id] ?? "")}
                disabled={readonly}
                onChange={(event) => change(column, event.target.value)}
                onBlur={(event) => void onSave({ ...row.data, [column.id]: event.target.value })}
                className="min-h-10 rounded-xl border border-otto-divider bg-otto-bg px-3 py-2 text-[14px] text-otto-text"
              />
            </label>
          );
        })}
      </div>
      {evaluation.err && (
        <p className="mt-2 text-[12px] font-semibold text-otto-red">Not counted: {evaluation.err}</p>
      )}
    </div>
  );
}

function ScreenBuilder({
  state,
  rowCount,
  busy,
  onCancel,
  onSave,
}: {
  state: BuilderState;
  rowCount: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: UserScreenInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<UserScreenInput>(state.draft);
  const [error, setError] = useState("");
  const textColumns = draft.columns.filter((column) => column.type === "text");
  const totalColumns = draft.columns.filter((column) => column.type === "number" || column.type === "auto");

  function patchColumn(id: string, patch: Partial<UserScreenColumn>) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
    }));
  }

  function removeColumn(id: string) {
    setDraft((current) => ({
      ...current,
      columns: current.columns
        .filter((column) => column.id !== id)
        .map((column) =>
          column.type === "auto" && (column.a === id || column.b === id)
            ? { ...column, a: undefined, b: undefined }
            : column,
        ),
      summary:
        current.summary?.by === id || current.summary?.sum === id ? null : current.summary,
    }));
  }

  return (
    <div className="mx-auto max-w-[760px] pb-10">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold">
            {state.mode === "new" ? "New User Screen" : "Edit columns"}
          </h1>
          <p className="text-[12px] text-otto-text-dim">
            {rowCount ? "Column types are locked because this screen has rows." : "Design the data you want to keep."}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-full bg-otto-surface" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      {error && <Notice text={error} tone="error" />}
      <label className="mb-4 grid gap-1 text-[12px] font-semibold text-otto-text-dim">
        Screen name
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          maxLength={60}
          className="min-h-11 rounded-xl border border-otto-divider bg-otto-surface px-3 text-[15px] text-otto-text"
        />
      </label>
      <h2 className="mb-2 text-[13px] font-extrabold">Columns</h2>
      <div className="space-y-2">
        {draft.columns.map((column) => (
          <div key={column.id} className="rounded-2xl bg-otto-surface p-3">
            <div className="flex items-center gap-2">
              <input
                value={column.label}
                onChange={(event) => patchColumn(column.id, { label: event.target.value })}
                maxLength={40}
                placeholder="Column name"
                aria-label="Column name"
                className="h-10 min-w-0 flex-1 rounded-xl border border-otto-divider bg-otto-bg px-3 text-[15px]"
              />
              <select
                value={column.type}
                disabled={
                  rowCount > 0 &&
                  state.mode === "edit" &&
                  state.list.columns.some((existing) => existing.id === column.id)
                }
                onChange={(event) =>
                  patchColumn(column.id, {
                    type: event.target.value as UserScreenColumn["type"],
                    a: undefined,
                    b: undefined,
                    op: undefined,
                  })
                }
                aria-label="Column type"
                className="h-10 w-[6.75rem] shrink-0 rounded-xl border border-otto-divider bg-otto-bg px-2 text-[13px]"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="check">Checkbox</option>
                <option value="auto">Formula</option>
              </select>
              <button type="button" onClick={() => removeColumn(column.id)} disabled={draft.columns.length === 1} className="flex h-10 w-10 shrink-0 items-center justify-center text-otto-text-faint disabled:opacity-30" aria-label="Remove column">
                <Trash2 size={16} />
              </button>
            </div>
            {column.type === "auto" && (
              <FormulaEditor column={column} columns={draft.columns} onPatch={(patch) => patchColumn(column.id, patch)} />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={draft.columns.length >= 20}
        onClick={() =>
          setDraft({
            ...draft,
            columns: [...draft.columns, { id: crypto.randomUUID(), label: "", type: "text" }],
          })
        }
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-otto-green text-sm font-bold text-otto-green disabled:opacity-30"
      >
        <Plus size={16} /> Add column
      </button>
      <div className="mt-5 rounded-2xl bg-otto-surface p-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-extrabold">Summary</h2>
            <p className="text-[11px] text-otto-text-dim">Optional totals grouped by a text column</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                summary: draft.summary
                  ? null
                  : textColumns[0] && totalColumns[0]
                    ? { by: textColumns[0].id, sum: totalColumns[0].id }
                    : null,
              })
            }
            disabled={!draft.summary && (!textColumns.length || !totalColumns.length)}
            className="rounded-full border border-otto-divider px-3 py-1.5 text-[12px] font-bold disabled:opacity-30"
          >
            {draft.summary ? "Remove" : "Add"}
          </button>
        </div>
        {draft.summary && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] text-otto-text-dim">
              Group by
              <select
                value={draft.summary.by}
                onChange={(event) => setDraft({ ...draft, summary: { ...draft.summary!, by: event.target.value } })}
                className="min-h-10 rounded-xl border border-otto-divider bg-otto-bg px-2 text-otto-text"
              >
                {textColumns.map((column) => <option key={column.id} value={column.id}>{column.label || "Unnamed"}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-otto-text-dim">
              Add up
              <select
                value={draft.summary.sum}
                onChange={(event) => setDraft({ ...draft, summary: { ...draft.summary!, sum: event.target.value } })}
                className="min-h-10 rounded-xl border border-otto-divider bg-otto-bg px-2 text-otto-text"
              >
                {totalColumns.map((column) => <option key={column.id} value={column.id}>{column.label || "Unnamed"}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const validation = validateUserScreen(draft);
          if (validation) {
            setError(validation);
            return;
          }
          setError("");
          void onSave(draft);
        }}
        className="mt-5 min-h-12 w-full rounded-full bg-otto-text font-extrabold text-otto-bg disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save screen"}
      </button>
    </div>
  );
}

function FormulaEditor({
  column,
  columns,
  onPatch,
}: {
  column: UserScreenColumn;
  columns: UserScreenColumn[];
  onPatch: (patch: Partial<UserScreenColumn>) => void;
}) {
  const source = columns.filter((item) => item.id !== column.id && (item.type === "date" || item.type === "number"));
  const a = source.find((item) => item.id === column.a);
  const compatible = source.filter((item) => !a || item.type === a.type);
  if (source.length < 2) {
    return <p className="mt-2 text-[11px] text-otto-amber">Add two date columns or two number columns to make this formula.</p>;
  }
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-end gap-2">
        <label className="grid min-w-0 gap-1 text-[11px] text-otto-text-dim">
          Column A
          <select value={column.a ?? ""} onChange={(event) => onPatch({ a: event.target.value, b: undefined })} className="h-10 min-w-0 rounded-xl border border-otto-divider bg-otto-bg px-2 text-[14px]">
            <option value="">Choose</option>
            {source.map((item) => <option key={item.id} value={item.id}>{item.label || "Unnamed"}</option>)}
          </select>
        </label>
        <select
          value={a?.type === "date" ? "-" : column.op ?? "+"}
          disabled={a?.type === "date"}
          onChange={(event) => onPatch({ op: event.target.value as "+" | "-" })}
          className="h-10 w-10 shrink-0 rounded-xl border border-otto-divider bg-otto-bg px-0 text-center text-[16px]"
          aria-label="Formula operator"
        >
          <option value="+">+</option>
          <option value="-">−</option>
        </select>
        <label className="grid min-w-0 gap-1 text-[11px] text-otto-text-dim">
          Column B
          <select value={column.b ?? ""} onChange={(event) => onPatch({ b: event.target.value })} className="h-10 min-w-0 rounded-xl border border-otto-divider bg-otto-bg px-2 text-[14px]">
            <option value="">Choose</option>
            {compatible.filter((item) => item.id !== column.a).map((item) => <option key={item.id} value={item.id}>{item.label || "Unnamed"}</option>)}
          </select>
        </label>
      </div>
      {a?.type === "date" && (
        <div className="grid gap-2">
          <label className="flex items-start gap-2.5 text-[13px] leading-5 text-otto-text">
            <input type="checkbox" checked={column.incl === true} onChange={(event) => onPatch({ incl: event.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 p-0" />
            <span>Include both end dates</span>
          </label>
          <label className="flex items-start gap-2.5 text-[13px] leading-5 text-otto-text">
            <input type="checkbox" checked={column.today === true} onChange={(event) => onPatch({ today: event.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 p-0" />
            <span>Count a blank A date as today</span>
          </label>
        </div>
      )}
    </div>
  );
}

function ScreensSettings({
  lists,
  rows,
  readonly,
  onEdit,
  onImport,
  onDelete,
}: {
  lists: UserScreen[];
  rows: Record<string, UserScreenRow[]>;
  readonly: boolean;
  onEdit: (list: UserScreen) => void;
  onImport: (backup: ReturnType<typeof parseUserScreenJson>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function importJson(file?: File) {
    if (!file) return;
    try {
      await onImport(parseUserScreenJson(await file.text()));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Import failed.");
    }
  }
  return (
    <>
      <SettingsPageHeader
        eyebrow="User Screens"
        title="Settings"
        description="Manage layouts, backups, and account preferences."
      />
      {message && <Notice text={message} tone="error" />}
      <OttoPreferencesEntry />
      <div className="mt-4 overflow-hidden rounded-2xl bg-otto-surface">
        {lists.map((list) => (
          <div key={list.id} className="border-b border-otto-divider p-4 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong className="block">{list.name}</strong>
                <span className="text-[12px] text-otto-text-dim">{rows[list.id]?.length ?? 0} rows</span>
              </div>
              <button type="button" onClick={() => onEdit(list)} className="rounded-full border border-otto-divider px-3 py-2 text-[12px] font-bold">
                Edit
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <DataTransferButton onClick={() => download(userScreenJson(list, rows[list.id] ?? []))}>JSON</DataTransferButton>
              <DataTransferButton onClick={() => download(userScreenCsv(list, rows[list.id] ?? []))}>CSV</DataTransferButton>
              <DataTransferButton
                variant="danger"
                disabled={readonly}
                onClick={() => {
                  if (confirm !== list.id) {
                    setConfirm(list.id);
                    return;
                  }
                  void onDelete(list.id);
                }}
              >
                {confirm === list.id ? "Confirm" : "Delete"}
              </DataTransferButton>
            </div>
          </div>
        ))}
        {!lists.length && <p className="px-4 py-8 text-center text-sm text-otto-text-dim">No screens to manage.</p>}
      </div>
      <button
        type="button"
        disabled={readonly || lists.length >= 4}
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-otto-divider font-bold disabled:opacity-40"
      >
        <Upload size={17} /> Import a screen from JSON
      </button>
      <input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={(event) => void importJson(event.target.files?.[0])} />
      <p className="mt-3 text-[11px] leading-relaxed text-otto-text-faint">
        One definition table and one row table hold every User Screen. New screens do not create database tables.
      </p>
    </>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-2xl bg-otto-surface px-3 py-3">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-otto-text-faint">{label}</span>
      <strong className={`mt-1 block text-xl ${warning ? "text-otto-red" : ""}`}>{value}</strong>
    </div>
  );
}

function Notice({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  return (
    <p className={`mb-3 rounded-xl px-3 py-2 text-[12px] ${tone === "error" ? "bg-otto-red-soft text-otto-red" : "bg-otto-green-soft text-otto-green"}`}>
      {text}
    </p>
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function download(file: { fileName: string; text: string }) {
  const url = URL.createObjectURL(new Blob([file.text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
