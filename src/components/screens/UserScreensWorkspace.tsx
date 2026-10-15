"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { UserScreensBottomNav } from "@/components/screens/UserScreensBottomNav";
import { UserScreensDataTransfer } from "@/components/screens/UserScreensDataTransfer";
import { OttoPreferencesEntry } from "@/components/settings/OttoPreferences";
import { DataTransferButton, DataTransferCard, DataTransferRow } from "@/components/settings/DataTransferPrimitives";
import { SettingsDetailScreen, SettingsPageHeader } from "@/components/settings/SettingsPrimitives";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useUserScreens } from "@/hooks/useUserScreens";
import {
  evalRow,
  screenRowPreview,
  userScreenAnalytics,
  type ScreenSummaryView,
} from "@/lib/userScreensEngine";
import {
  USER_SCREEN_TEMPLATES,
  blankScreenTemplate,
  validateUserScreen,
} from "@/lib/userScreensTemplates";
import { screenIcon, USER_SCREEN_ICON_OPTIONS } from "@/lib/userScreenIcons";
import { suggestedScreenIcon } from "@/lib/userScreensSummaries";
import { parseUserScreenJson } from "@/lib/userScreensTransfer";
import {
  USER_SCREEN_SUMMARY_LIMIT,
  type UserScreen,
  type UserScreenIcon,
  type UserScreenColumn,
  type UserScreenInput,
  type UserScreenRow,
  type UserScreenRowData,
} from "@/types/userScreens";

type BuilderState = { mode: "new"; draft: UserScreenInput } | { mode: "edit"; list: UserScreen; draft: UserScreenInput };

export function UserScreensWorkspace() {
  const data = useUserScreens();
  const [tab, setTab] = useScreenOption("screensTab");
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lists = data.lists;
  const active =
    tab === "overview" || tab === "settings" || lists.some((list) => list.id === tab)
      ? tab
      : "overview";

  useEffect(() => {
    if (tab !== "new") return;
    setShowTemplates(lists.length < 4);
    setTab("overview");
  }, [lists.length, setTab, tab]);
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
          onNew={() => setShowTemplates(true)}
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
                summaries: item.summaries.map((summary) => ({ ...summary })),
                icon: item.icon || suggestedScreenIcon(item.name),
              },
            })
          }
          onImportScreen={async (backup) => {
            const saved = await data.createList(
              { name: backup.name, columns: backup.columns, summaries: backup.summaries, icon: backup.icon },
              backup.rows,
            );
            setTab(saved.id);
            setNotice(`Imported ${backup.name}.`);
          }}
          onImportRows={async (target, imported, added) => {
            if (added.length) {
              await data.updateList(target.id, {
                name: target.name,
                columns: [...target.columns, ...added],
                summaries: target.summaries,
                icon: target.icon,
              });
            }
            await data.addRows(target.id, imported);
            setTab(target.id);
            const addedNote = added.length ? ` · added ${added.map((column) => column.label).join(", ")}` : "";
            setNotice(`Imported ${imported.length} rows${addedNote}.`);
          }}
          onDelete={async (id) => {
            await data.deleteList(id);
            setTab("overview");
            setNotice("Screen deleted.");
          }}
          onDeleteRows={async (id) => {
            const target = lists.find((item) => item.id === id);
            await data.deleteRows(id);
            setNotice(target ? `Rows removed from ${target.name}.` : "Rows removed.");
          }}
          onMove={async (id, direction) => {
            await data.moveList(id, direction);
            setNotice("Screen order updated.");
          }}
          onNew={() => setShowTemplates(true)}
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
                summaries: list.summaries.map((summary) => ({ ...summary })),
                icon: list.icon || suggestedScreenIcon(list.name),
              },
            })
          }
          onCreate={(row) => data.addRows(list.id, [row])}
          onSave={(rowId, row) => data.updateRow(list.id, rowId, row)}
          onDelete={(rowId) => data.deleteRow(list.id, rowId)}
        />
      ) : null}
      {showTemplates && (
        <SettingsDetailScreen title="New screen" eyebrow="User Screens" onClose={() => setShowTemplates(false)}>
          <p className="-mt-3 mb-4 text-[13px] text-otto-text-dim">Choose a starting point. Every detail can be changed.</p>
          <TemplatePicker
            disabled={data.readonly || lists.length >= 4}
            onPick={(draft) => {
              setShowTemplates(false);
              setBuilder({ mode: "new", draft });
            }}
          />
        </SettingsDetailScreen>
      )}
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
      <div className="space-y-3">
        {lists.map((list) => {
          const analytics = userScreenAnalytics(list, rows[list.id] ?? []);
          return (
            <section key={list.id} className="rounded-2xl bg-otto-surface p-3">
              <button
                type="button"
                onClick={() => onOpen(list.id)}
                className="flex w-full items-center justify-between gap-3 px-1 py-1 text-left"
              >
                <h2 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">{list.name}</h2>
                <span className="shrink-0 text-[12px] text-otto-text-dim">
                  {analytics.rows} {analytics.rows === 1 ? "row" : "rows"}
                </span>
                <ChevronRight size={16} className="shrink-0 text-otto-text-faint" />
              </button>
              {analytics.summaries.length > 0 && (
                <div className="mt-3 grid gap-2 desk:grid-cols-2">
                  {analytics.summaries.map((summary) => (
                    <OverviewSummary
                      key={`${summary.by}:${summary.sum}`}
                      summary={summary}
                    />
                  ))}
                </div>
              )}
              {analytics.skipped > 0 && (
                <span className="mt-3 inline-flex rounded-full bg-otto-red-soft px-2.5 py-1 text-[11px] font-semibold text-otto-red">
                  {analytics.skipped} not counted
                </span>
              )}
            </section>
          );
        })}
        {!lists.length && (
          <div className="rounded-2xl bg-otto-surface px-5 py-12 text-center">
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

const SUMMARY_COLORS = ["#2bcf83", "#60a5fa", "#f59e0b", "#a78bfa", "#f472b6", "#22d3ee"];

function OverviewSummary({ summary }: { summary: ScreenSummaryView }) {
  const items = summary.totals
    .slice()
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 6);
  const title = `${summary.sumLabel} by ${summary.byLabel}`;

  return (
    <div className="rounded-xl bg-otto-bg/70 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate text-[12px] font-extrabold">{title}</h3>
        <strong className="shrink-0 text-[13px]">{formatNumber(summary.total)}</strong>
      </div>
      {!items.length ? (
        <p className="mt-3 text-[12px] text-otto-text-dim">No totals yet.</p>
      ) : summary.view === "donut" ? (
        <SummaryDonut items={items} />
      ) : summary.view === "totals" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg bg-otto-surface px-2.5 py-2">
              <span className="block truncate text-[10px] text-otto-text-faint">{item.label}</span>
              <strong className="mt-0.5 block text-[15px]">{formatNumber(item.value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <SummaryBars items={items} />
      )}
      {summary.totals.length > items.length && (
        <p className="mt-2 text-[10px] text-otto-text-faint">
          Showing {items.length} of {summary.totals.length} groups
        </p>
      )}
      {summary.skipped > 0 && (
        <p className="mt-2 text-[10px] font-semibold text-otto-red">
          {summary.skipped} not counted
        </p>
      )}
    </div>
  );
}

function SummaryBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  return (
    <div className="mt-2">
      {items.map((item) => (
        <div key={item.label} className="mt-2 grid grid-cols-[72px_1fr_50px] items-center gap-2 text-[11px]">
          <span className="truncate text-otto-text-dim">{item.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-otto-divider">
            <span
              className="block h-full rounded-full bg-otto-green"
              style={{ width: `${(Math.abs(item.value) / max) * 100}%` }}
            />
          </span>
          <strong className="text-right">{formatNumber(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function SummaryDonut({ items }: { items: { label: string; value: number }[] }) {
  const total = items.reduce((sum, item) => sum + Math.abs(item.value), 0);
  let at = 0;
  const stops = items.map((item, index) => {
    const start = at;
    at += total ? (Math.abs(item.value) / total) * 360 : 0;
    return `${SUMMARY_COLORS[index]} ${start}deg ${at}deg`;
  });
  return (
    <div className="mt-3 flex items-center gap-4">
      <div
        aria-label="Donut chart"
        className="h-20 w-20 shrink-0 rounded-full"
        style={{
          background: total
            ? `radial-gradient(circle, rgb(var(--otto-bg)) 0 48%, transparent 50%), conic-gradient(${stops.join(",")})`
            : "rgb(var(--otto-divider))",
        }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        {items.map((item, index) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[10.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SUMMARY_COLORS[index] }} />
            <span className="min-w-0 flex-1 truncate text-otto-text-dim">{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
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
    <div className="overflow-hidden rounded-2xl bg-otto-surface">
      {USER_SCREEN_TEMPLATES.map((template) => {
        const Icon = screenIcon(template.icon);
        return (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(template.create())}
            className="flex min-h-16 w-full items-center gap-3 border-b border-otto-divider px-4 py-3 text-left last:border-b-0 disabled:opacity-40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-otto-green-soft text-otto-green">
              <Icon size={19} />
            </span>
            <span>
              <strong className="block text-[15px]">{template.label}</strong>
              <span className="text-[12px] text-otto-text-dim">{template.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const PAGE_SIZES = [10, 20, 50, 100, null] as const;
type ScreenPageSize = (typeof PAGE_SIZES)[number];
const PAGE_SIZE_KEY = "trader-otto:screens-page-size";
type ScreenSort = { columnId: string; dir: "asc" | "desc" };
const SORT_KEY = "trader-otto:screens-sort";

function readSort(listId: string): ScreenSort {
  if (typeof window === "undefined") return { columnId: "added", dir: "asc" };
  try {
    const raw = JSON.parse(window.localStorage.getItem(SORT_KEY) || "{}") as Record<string, ScreenSort>;
    const saved = raw[listId];
    if (saved && typeof saved.columnId === "string" && (saved.dir === "asc" || saved.dir === "desc")) {
      return saved;
    }
  } catch {
    // The list still opens in the order rows were added.
  }
  return { columnId: "added", dir: "asc" };
}

function writeSort(listId: string, sort: ScreenSort) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SORT_KEY) || "{}") as Record<string, ScreenSort>;
    raw[listId] = sort;
    window.localStorage.setItem(SORT_KEY, JSON.stringify(raw));
  } catch {
    // The chosen sort still applies for this visit.
  }
}

function sortChoices(list: UserScreen): Array<ScreenSort & { label: string }> {
  const choices: Array<ScreenSort & { label: string }> = [
    { columnId: "added", dir: "asc", label: "Oldest added" },
    { columnId: "added", dir: "desc", label: "Newest added" },
  ];
  for (const column of list.columns) {
    const name = column.label || "Unnamed";
    if (column.type === "number" || column.type === "auto") {
      choices.push({ columnId: column.id, dir: "asc", label: `${name} low to high` });
      choices.push({ columnId: column.id, dir: "desc", label: `${name} high to low` });
    } else if (column.type === "date") {
      choices.push({ columnId: column.id, dir: "asc", label: `${name} oldest` });
      choices.push({ columnId: column.id, dir: "desc", label: `${name} newest` });
    } else if (column.type === "check") {
      choices.push({ columnId: column.id, dir: "desc", label: `${name} checked first` });
      choices.push({ columnId: column.id, dir: "asc", label: `${name} unchecked first` });
    } else {
      choices.push({ columnId: column.id, dir: "asc", label: `${name} A–Z` });
      choices.push({ columnId: column.id, dir: "desc", label: `${name} Z–A` });
    }
  }
  return choices;
}

function rankRow(list: UserScreen, row: UserScreenRow, columnId: string) {
  if (columnId === "added") return { empty: false, num: 0, text: row.createdAt || row.id };
  const column = list.columns.find((item) => item.id === columnId);
  if (!column) return { empty: false, num: 0, text: row.createdAt || row.id };
  if (column.type === "check") return { empty: false, num: row.data[column.id] === true ? 1 : 0, text: "" };
  if (column.type === "auto") {
    const result = evalRow(list, row.data).vals[column.id];
    return result && "v" in result ? { empty: false, num: result.v, text: "" } : { empty: true, num: 0, text: "" };
  }
  if (column.type === "number") {
    const raw = String(row.data[column.id] ?? "").trim();
    const value = Number.parseFloat(raw);
    return raw && Number.isFinite(value) ? { empty: false, num: value, text: "" } : { empty: true, num: 0, text: "" };
  }
  const text = String(row.data[column.id] ?? "").trim();
  return text ? { empty: false, num: 0, text: text.toLocaleLowerCase() } : { empty: true, num: 0, text: "" };
}

function readPageSize(): ScreenPageSize {
  if (typeof window === "undefined") return 20;
  try {
    const raw = window.localStorage.getItem(PAGE_SIZE_KEY);
    if (raw === "none") return null;
    const parsed = Number(raw);
    return parsed === 10 || parsed === 20 || parsed === 50 || parsed === 100 ? parsed : 20;
  } catch {
    return 20;
  }
}

function ScreenRows({
  list,
  rows,
  readonly,
  onEditColumns,
  onCreate,
  onSave,
  onDelete,
}: {
  list: UserScreen;
  rows: UserScreenRow[];
  readonly: boolean;
  onEditColumns: () => void;
  onCreate: (row: UserScreenRowData) => Promise<unknown>;
  onSave: (rowId: string, row: UserScreenRowData) => Promise<unknown>;
  onDelete: (rowId: string) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ScreenPageSize>(readPageSize);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ScreenSort>(() => readSort(list.id));
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<UserScreenRow | null | "new">(null);
  const analytics = useMemo(() => userScreenAnalytics(list, rows), [list, rows]);
  const sortColumn = list.columns.find((column) => column.id === sort.columnId);
  const sortId = sort.columnId === "added" || sortColumn ? sort.columnId : "added";
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const preview = screenRowPreview(list, row.data);
      return (
        preview.title.toLocaleLowerCase().includes(needle) ||
        preview.detail.toLocaleLowerCase().includes(needle) ||
        list.columns.some((column) => String(row.data[column.id] ?? "").toLocaleLowerCase().includes(needle))
      );
    });
  }, [list, query, rows]);
  const sorted = useMemo(() => {
    const numeric = sortColumn?.type === "number" || sortColumn?.type === "auto" || sortColumn?.type === "check";
    const ranks = new Map(filtered.map((row) => [row.id, rankRow(list, row, sortId)]));
    return [...filtered].sort((a, b) => {
      const left = ranks.get(a.id) ?? { empty: true, num: 0, text: "" };
      const right = ranks.get(b.id) ?? { empty: true, num: 0, text: "" };
      if (left.empty !== right.empty) return left.empty ? 1 : -1;
      const base = numeric ? left.num - right.num : left.text.localeCompare(right.text);
      const compared = base || a.id.localeCompare(b.id);
      return sort.dir === "asc" ? compared : -compared;
    });
  }, [filtered, list, sort.dir, sortColumn, sortId]);
  const pageCount = pageSize == null ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = pageSize == null ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
    setEditing(null);
    setQuery("");
    setSortOpen(false);
    setSort(readSort(list.id));
  }, [list.id]);

  useEffect(() => {
    if (!sortOpen) return;
    function close(event: PointerEvent) {
      if (sortMenuRef.current?.contains(event.target as Node)) return;
      setSortOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [sortOpen]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  function choosePageSize(size: ScreenPageSize) {
    setPageSize(size);
    setPage(1);
    try {
      window.localStorage.setItem(PAGE_SIZE_KEY, size == null ? "none" : String(size));
    } catch {
      // The list still uses the chosen size for this visit.
    }
  }

  function chooseSort(next: ScreenSort) {
    const columnId =
      next.columnId === "added" || list.columns.some((column) => column.id === next.columnId)
        ? next.columnId
        : "added";
    const saved = { columnId, dir: next.dir };
    setSort(saved);
    setPage(1);
    setSortOpen(false);
    writeSort(list.id, saved);
  }

  if (editing) {
    return (
      <ScreenRowPage
        list={list}
        row={editing === "new" ? null : editing}
        readonly={readonly}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (editing === "new") await onCreate(data);
          else await onSave(editing.id, data);
        }}
        onDelete={
          editing === "new"
            ? undefined
            : async () => {
                await onDelete(editing.id);
              }
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold">{list.name}</h1>
          <p className="text-[12px] text-otto-text-dim">
            {rows.length} {rows.length === 1 ? "row" : "rows"} · {analytics.completionPct}% counted
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEditColumns} className="rounded-full border border-otto-divider px-3 py-2 text-[12px] font-bold">
            Edit columns
          </button>
          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setSortOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-otto-text-faint hover:bg-otto-surface"
              aria-label="Sort rows"
              aria-expanded={sortOpen}
            >
              <MoreHorizontal size={20} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-9 z-20 max-h-80 w-56 overflow-y-auto rounded-xl border border-otto-divider bg-otto-bg p-1.5 shadow-xl">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-otto-text-faint">
                  Sort by
                </p>
                {sortChoices(list).map((choice) => (
                  <button
                    key={`${choice.columnId}:${choice.dir}`}
                    type="button"
                    onClick={() => chooseSort(choice)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium hover:bg-otto-surface"
                  >
                    <span className="flex-1">{choice.label}</span>
                    {sortId === choice.columnId && sort.dir === choice.dir && (
                      <Check size={15} className="shrink-0 text-otto-green" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <label className="mb-3 flex items-center gap-2 rounded-xl bg-otto-surface px-3">
        <Search size={16} className="shrink-0 text-otto-text-faint" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search rows"
          aria-label="Search rows"
          className="h-11 w-auto min-w-0 flex-1 border-0 bg-transparent px-0 text-[14px]"
        />
      </label>
      <div className="flex flex-col gap-2">
        {visible.map((row) => {
          const preview = screenRowPreview(list, row.data);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setEditing(row)}
              className="flex w-full items-center gap-3 rounded-2xl bg-otto-surface px-3 py-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-otto-green-soft text-[15px] font-black text-otto-green">
                {(preview.title.trim()[0] || "?").toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold">{preview.title}</span>
                <span className={`mt-0.5 block truncate text-[12px] ${preview.invalid ? "text-otto-red" : "text-otto-text-dim"}`}>
                  {preview.invalid ? preview.error : preview.detail || "No details yet"}
                </span>
              </span>
              {preview.metric && (
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-extrabold">{preview.metric}</span>
                  <span className="block text-[10px] text-otto-text-faint">{preview.metricLabel}</span>
                </span>
              )}
              <ChevronRight size={16} className="shrink-0 text-otto-text-faint" />
            </button>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="rounded-2xl bg-otto-surface px-5 py-10 text-center text-sm text-otto-text-dim">
          {rows.length ? "No rows match that search." : "No rows yet. Add the first one below."}
        </div>
      )}
      {filtered.length > 0 && (
        <div className="mt-3 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-otto-text-dim disabled:opacity-35"
            >
              Previous
            </button>
            <span className="text-center text-[11.5px] font-medium text-otto-text-dim">
              {pageSize == null
                ? `All ${filtered.length}`
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-otto-text-dim disabled:opacity-35"
            >
              Next
            </button>
          </div>
          <div className="mt-2 flex justify-center gap-1">
            {PAGE_SIZES.map((size) => (
              <button
                key={size ?? "none"}
                type="button"
                aria-pressed={pageSize === size}
                onClick={() => choosePageSize(size)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  pageSize === size ? "bg-otto-text text-otto-bg" : "text-otto-text-dim"
                }`}
              >
                {size ?? "None"}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={readonly || rows.length >= 5000}
        onClick={() => setEditing("new")}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-otto-green font-bold text-otto-green disabled:opacity-40"
      >
        <Plus size={17} /> Add row
      </button>
      {analytics.summaries.length > 0 && (
        <div className="sticky bottom-[76px] z-10 mt-4 space-y-3 rounded-2xl border border-otto-divider bg-otto-bg/95 p-3 shadow-lg backdrop-blur desk:bottom-2">
          {analytics.summaries.map((summary) => (
            <div key={`${summary.by}:${summary.sum}`}>
              <p className="text-[11px] font-semibold text-otto-text-faint">
                {summary.sumLabel} by {summary.byLabel}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {summary.totals.map((item) => (
                  <span key={item.label}><b>{item.label}</b> {formatNumber(item.value)}</span>
                ))}
                {summary.skipped > 0 && (
                  <span className="font-semibold text-otto-red">{summary.skipped} not counted</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ScreenRowPage({
  list,
  row,
  readonly,
  onClose,
  onSave,
  onDelete,
}: {
  list: UserScreen;
  row: UserScreenRow | null;
  readonly: boolean;
  onClose: () => void;
  onSave: (data: UserScreenRowData) => Promise<unknown>;
  onDelete?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<UserScreenRowData>(row?.data ?? {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const evaluation = evalRow(list, draft);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave(draft);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The row could not be saved.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-otto-text-dim">
        <ChevronLeft size={16} /> {list.name}
      </button>
      <h1 className="text-[24px] font-extrabold">{row ? "Edit row" : "New row"}</h1>
      {error && <p className="mt-3 rounded-xl bg-otto-red-soft px-3 py-2 text-[12px] text-otto-red">{error}</p>}
      <div className="mt-4 space-y-3">
        {list.columns.map((column) => {
          const result = evaluation.vals[column.id];
          if (column.type === "auto") {
            return (
              <div key={column.id} className="rounded-2xl bg-otto-surface px-4 py-3">
                <span className="block text-[11px] font-semibold text-otto-text-dim">{column.label}</span>
                <span className="mt-1 block text-[18px] font-extrabold">
                  {result && "v" in result ? formatNumber(result.v) : "—"}
                </span>
              </div>
            );
          }
          if (column.type === "check") {
            return (
              <label key={column.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-otto-surface px-4 text-[14px] font-semibold">
                <input
                  type="checkbox"
                  checked={draft[column.id] === true}
                  disabled={readonly}
                  onChange={(event) => setDraft({ ...draft, [column.id]: event.target.checked })}
                  className="h-5 w-5 shrink-0 p-0"
                />
                {column.label}
              </label>
            );
          }
          return (
            <label key={column.id} className="grid gap-1 text-[12px] font-semibold text-otto-text-dim">
              {column.label}
              <input
                type={column.type === "number" ? "number" : column.type}
                inputMode={column.type === "number" ? "decimal" : undefined}
                value={String(draft[column.id] ?? "")}
                disabled={readonly}
                onChange={(event) => setDraft({ ...draft, [column.id]: event.target.value })}
                className="h-11 rounded-xl border border-otto-divider bg-otto-surface px-3 text-[15px] text-otto-text"
              />
            </label>
          );
        })}
      </div>
      {evaluation.err && (
        <p className="mt-3 text-[12px] font-semibold text-otto-red">Not counted: {evaluation.err}</p>
      )}
      <button
        type="button"
        disabled={readonly || busy}
        onClick={() => void save()}
        className="mt-5 min-h-12 w-full rounded-full bg-otto-text font-extrabold text-otto-bg disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save row"}
      </button>
      {onDelete && (
        <button
          type="button"
          disabled={readonly || busy}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            void onDelete()
              .then(onClose)
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "The row could not be deleted.");
              });
          }}
          className={`mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold ${
            confirmDelete ? "bg-otto-red text-white" : "text-otto-text-dim"
          }`}
        >
          <Trash2 size={15} /> {confirmDelete ? "Tap again to delete" : "Delete row"}
        </button>
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
    setDraft((current) => {
      const columns = current.columns.map((column) => (column.id === id ? { ...column, ...patch } : column));
      const summaries = patch.type
        ? current.summaries.filter((summary) => {
            if (summary.by === id && patch.type !== "text") return false;
            if (summary.sum === id && patch.type !== "number" && patch.type !== "auto") return false;
            return true;
          })
        : current.summaries;
      return { ...current, columns, summaries };
    });
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
      summaries: current.summaries.filter((summary) => summary.by !== id && summary.sum !== id),
    }));
  }

  function addSummary() {
    const used = new Set(draft.summaries.map((summary) => `${summary.by}:${summary.sum}`));
    for (const by of textColumns) {
      for (const sum of totalColumns) {
        if (used.has(`${by.id}:${sum.id}`)) continue;
        setDraft({
          ...draft,
          summaries: [...draft.summaries, { by: by.id, sum: sum.id, view: "bar" }],
        });
        return;
      }
    }
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
      <div className="mb-4">
        <p className="mb-2 text-[12px] font-semibold text-otto-text-dim">Bottom bar icon</p>
        <div className="grid grid-cols-6 gap-2">
          {USER_SCREEN_ICON_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = (draft.icon || "grid") === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-label={option.label}
                aria-pressed={selected}
                onClick={() => setDraft({ ...draft, icon: option.id as UserScreenIcon })}
                className={`flex h-11 items-center justify-center rounded-xl border ${
                  selected ? "border-otto-green bg-otto-green-soft text-otto-green" : "border-otto-divider bg-otto-surface text-otto-text-dim"
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      </div>
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-extrabold">Summaries</h2>
            <p className="text-[11px] text-otto-text-dim">Group a text column and total a number or formula</p>
          </div>
          <button
            type="button"
            onClick={addSummary}
            disabled={
              !textColumns.length ||
              !totalColumns.length ||
              draft.summaries.length >= USER_SCREEN_SUMMARY_LIMIT ||
              draft.summaries.length >= textColumns.length * totalColumns.length
            }
            className="rounded-full border border-otto-divider px-3 py-1.5 text-[12px] font-bold disabled:opacity-30"
          >
            Add
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {draft.summaries.map((summary, index) => (
            <div key={`${index}:${summary.by}:${summary.sum}`} className="rounded-xl bg-otto-bg p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-[11px]">Summary {index + 1}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, summaries: draft.summaries.filter((_, itemIndex) => itemIndex !== index) })
                  }
                  className="flex h-8 w-8 items-center justify-center text-otto-text-faint"
                  aria-label={`Remove summary ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid min-w-0 gap-1 text-[11px] text-otto-text-dim">
                  Group by
                  <select
                    value={summary.by}
                    aria-label={`Summary ${index + 1} group`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        summaries: draft.summaries.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, by: event.target.value } : item,
                        ),
                      })
                    }
                    className="min-h-10 w-full rounded-xl border border-otto-divider bg-otto-surface px-2 text-otto-text"
                  >
                    {textColumns.map((column) => <option key={column.id} value={column.id}>{column.label || "Unnamed"}</option>)}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1 text-[11px] text-otto-text-dim">
                  Add up
                  <select
                    value={summary.sum}
                    aria-label={`Summary ${index + 1} total`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        summaries: draft.summaries.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, sum: event.target.value } : item,
                        ),
                      })
                    }
                    className="min-h-10 w-full rounded-xl border border-otto-divider bg-otto-surface px-2 text-otto-text"
                  >
                    {totalColumns.map((column) => <option key={column.id} value={column.id}>{column.label || "Unnamed"}</option>)}
                  </select>
                </label>
                <label className="col-span-2 grid min-w-0 gap-1 text-[11px] text-otto-text-dim">
                  Overview style
                  <select
                    value={summary.view ?? "bar"}
                    aria-label={`Summary ${index + 1} overview style`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        summaries: draft.summaries.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, view: event.target.value as "bar" | "donut" | "totals" }
                            : item,
                        ),
                      })
                    }
                    className="min-h-10 w-full rounded-xl border border-otto-divider bg-otto-surface px-2 text-otto-text"
                  >
                    <option value="bar">Bar chart</option>
                    <option value="donut">Donut chart</option>
                    <option value="totals">Total cards</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
          {!draft.summaries.length && (
            <p className="text-[12px] text-otto-text-dim">No summaries yet.</p>
          )}
        </div>
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
  onImportScreen,
  onImportRows,
  onDelete,
  onDeleteRows,
  onMove,
  onNew,
}: {
  lists: UserScreen[];
  rows: Record<string, UserScreenRow[]>;
  readonly: boolean;
  onEdit: (list: UserScreen) => void;
  onImportScreen: (backup: ReturnType<typeof parseUserScreenJson>) => Promise<void>;
  onImportRows: (
    list: UserScreen,
    imported: UserScreenRowData[],
    addedColumns: UserScreenColumn[],
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteRows: (id: string) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
  onNew: () => void;
}) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [clearId, setClearId] = useState("");
  const [clearProof, setClearProof] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [movingId, setMovingId] = useState("");
  const [moveError, setMoveError] = useState("");
  const clearTarget = lists.find((list) => list.id === clearId) ?? null;
  const clearCount = clearTarget ? (rows[clearTarget.id]?.length ?? 0) : 0;
  const clearReady = Boolean(clearTarget && clearCount > 0 && clearProof.trim() === clearTarget.name);
  return (
    <>
      <SettingsPageHeader
        eyebrow="User Screens"
        title="Settings"
        description="Manage layouts, backups, and account preferences."
      />
      <div className="mt-5">
        <OttoPreferencesEntry />
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <DataTransferRow detail="Workbook, CSV, or screen backup" onClick={() => setTransferOpen(true)} />
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
      <h2 className="mb-2 mt-4 text-[13px] font-extrabold">Screen order & layouts</h2>
      <div className="overflow-hidden rounded-2xl bg-otto-surface">
        {lists.map((list, index) => (
          <div key={list.id} className="flex items-center justify-between gap-3 border-b border-otto-divider px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 items-center gap-3">
              {(() => {
                const Icon = screenIcon(list.icon, list.name);
                return <Icon size={18} className="shrink-0 text-otto-text-dim" />;
              })()}
              <div className="min-w-0">
                <strong className="block truncate">{list.name}</strong>
                <span className="text-[12px] text-otto-text-dim">{rows[list.id]?.length ?? 0} rows</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Move ${list.name} up`}
                disabled={readonly || movingId !== "" || index === 0}
                onClick={() => {
                  setMovingId(list.id);
                  setMoveError("");
                  void onMove(list.id, -1)
                    .catch((cause: unknown) => {
                      setMoveError(cause instanceof Error ? cause.message : "The screen could not be moved.");
                    })
                    .finally(() => setMovingId(""));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-otto-text-dim disabled:opacity-25"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`Move ${list.name} down`}
                disabled={readonly || movingId !== "" || index === lists.length - 1}
                onClick={() => {
                  setMovingId(list.id);
                  setMoveError("");
                  void onMove(list.id, 1)
                    .catch((cause: unknown) => {
                      setMoveError(cause instanceof Error ? cause.message : "The screen could not be moved.");
                    })
                    .finally(() => setMovingId(""));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-otto-text-dim disabled:opacity-25"
              >
                <ArrowDown size={15} />
              </button>
              <button type="button" onClick={() => onEdit(list)} className="rounded-full border border-otto-divider px-3 py-2 text-[12px] font-bold">
                Edit
              </button>
              <button
                type="button"
                disabled={readonly}
                onClick={() => {
                  if (confirm !== list.id) {
                    setConfirm(list.id);
                    return;
                  }
                  void onDelete(list.id);
                }}
                className={`rounded-full px-3 py-2 text-[12px] font-bold disabled:opacity-40 ${
                  confirm === list.id ? "bg-otto-red text-white" : "text-otto-text-dim"
                }`}
              >
                {confirm === list.id ? "Confirm" : "Delete"}
              </button>
            </div>
          </div>
        ))}
        {!lists.length && <p className="px-4 py-8 text-center text-sm text-otto-text-dim">No screens to manage.</p>}
      </div>
      {moveError && <p className="mt-2 text-[12px] font-semibold text-otto-red">{moveError}</p>}
      <div className="mt-4">
        <DataTransferCard
          icon={Trash2}
          title="Delete all rows"
          description="Removes every row on one screen. Columns and summaries stay. Type the screen name to confirm."
        >
          <label className="grid gap-1 text-[12px] font-semibold text-otto-text-dim">
            Screen
            <select
              value={clearId}
              disabled={!lists.length || clearing}
              onChange={(event) => {
                setClearId(event.target.value);
                setClearProof("");
                setClearError("");
              }}
              className="h-11 rounded-xl border border-otto-divider bg-otto-bg px-3 text-[14px] text-otto-text"
            >
              <option value="">Choose a screen</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} · {rows[list.id]?.length ?? 0} rows
                </option>
              ))}
            </select>
          </label>
          {clearTarget && (
            <label className="mt-3 grid gap-1 text-[12px] font-semibold text-otto-text-dim">
              Type {clearTarget.name} to delete {clearCount} {clearCount === 1 ? "row" : "rows"}
              <input
                value={clearProof}
                disabled={clearing || clearCount === 0}
                onChange={(event) => {
                  setClearProof(event.target.value);
                  setClearError("");
                }}
                autoComplete="off"
                aria-label="Confirm screen name"
                className="h-11 rounded-xl border border-otto-divider bg-otto-bg px-3 text-[14px] text-otto-text"
              />
            </label>
          )}
          <div className="mt-3">
            <DataTransferButton
              variant="danger"
              disabled={readonly || clearing || !clearReady}
              onClick={() => {
                if (!clearTarget || clearProof.trim() !== clearTarget.name || clearCount === 0) {
                  setClearError("Type the screen name exactly before deleting its rows.");
                  return;
                }
                setClearing(true);
                setClearError("");
                void onDeleteRows(clearTarget.id)
                  .then(() => {
                    setClearProof("");
                    setClearId("");
                  })
                  .catch((cause: unknown) => {
                    setClearError(cause instanceof Error ? cause.message : "The rows could not be deleted.");
                  })
                  .finally(() => setClearing(false));
              }}
            >
              <Trash2 size={14} />
              {clearing ? "Deleting rows…" : clearCount ? `Delete ${clearCount} rows` : "Delete all rows"}
            </DataTransferButton>
          </div>
          {clearError && <p className="mt-2 text-[12px] font-semibold text-otto-red">{clearError}</p>}
        </DataTransferCard>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-otto-text-faint">
        One definition table and one row table hold every User Screen. New screens do not create database tables.
      </p>
      {transferOpen && (
        <UserScreensDataTransfer
          lists={lists}
          rows={rows}
          readonly={readonly}
          onClose={() => setTransferOpen(false)}
          onImportRows={onImportRows}
          onImportScreen={onImportScreen}
        />
      )}
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

