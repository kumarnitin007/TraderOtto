"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarHeart, Plus, Star, X } from "lucide-react";
import { LifeBottomNav } from "@/components/life/LifeBottomNav";
import { LifeSettingsScreen } from "@/components/life/LifeSettingsScreen";
import { LifeTasksScreen } from "@/components/life/LifeTasksScreen";
import { useLife } from "@/hooks/useLife";
import { useScreenOption } from "@/hooks/useScreenOption";
import {
  LIFE_CATEGORY_LABEL,
  applyLifeDate,
  lifeCountdownLabel,
  lifeDateInput,
  lifeDaysUntil,
  lifeIdentityKey,
  lifeOccasionLabel,
} from "@/lib/life";
import { lifeTaskKey, taskProgress } from "@/lib/lifeTasks";
import type { LifeCategory, LifeInput, LifeItem, LifeTaskInput } from "@/types/life";
import { EMPTY_LIFE_INPUT, LIFE_CATEGORIES } from "@/types/life";

const COLORS: Record<LifeCategory, string> = {
  birthday: "#3f68a0",
  anniversary: "#bd5038",
  holiday: "#75507a",
  special: "#3e8179",
  other: "#ad7d22",
};

type Filter = "all" | LifeCategory | "milestones";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "•";
}

function sectionFor(days: number) {
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days <= 14) return "Soon";
  return "Upcoming";
}

export function LifeWorkspace() {
  const { items, tasks, checks, loading, error, taskError, readonly, save, remove, saveTask, removeTask, toggleToday } =
    useLife();
  const [tab, setTab] = useScreenOption("lifeTab");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<LifeInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskEditing, setTaskEditing] = useState(false);
  const [selected, setSelected] = useState<LifeItem | null>(null);
  const [incoming, setIncoming] = useState<{ dates: LifeInput[]; tasks: LifeTaskInput[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => {
    return items
      .filter((item) => {
        if (filter === "milestones") return item.milestone;
        if (filter === "all") return true;
        return item.category === filter;
      })
      .map((item) => ({ item, days: lifeDaysUntil(item) }))
      .sort((a, b) => a.days - b.days || a.item.name.localeCompare(b.item.name));
  }, [filter, items]);

  const groups = useMemo(() => {
    const order = ["Today", "Soon", "Upcoming", "Past"];
    return order
      .map((label) => ({
        label,
        rows: visible.filter((row) => sectionFor(row.days) === label),
      }))
      .filter((group) => group.rows.length);
  }, [visible]);

  async function onSave(input: LifeInput) {
    setBusy(true);
    setNotice("");
    try {
      await save(input, editingId ?? undefined);
      setEditing(null);
      setEditingId(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!incoming) return;
    setBusy(true);
    setNotice("");
    try {
      const existingDates = new Set(items.map(lifeIdentityKey));
      const existingTasks = new Set(tasks.map(lifeTaskKey));
      let added = 0;
      for (const item of incoming.dates) {
        if (existingDates.has(lifeIdentityKey(item))) continue;
        await save(item);
        added += 1;
      }
      for (const task of incoming.tasks) {
        if (existingTasks.has(lifeTaskKey(task))) continue;
        await saveTask(task);
        added += 1;
      }
      setIncoming(null);
      setNotice(added ? `Added ${added}.` : "Those are already here.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not import.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveTask(input: LifeTaskInput, id?: string) {
    setBusy(true);
    setNotice("");
    try {
      await saveTask(input, id);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <LifeEditor
        initial={editing}
        busy={busy}
        notice={notice}
        onCancel={() => {
          setEditing(null);
          setEditingId(null);
        }}
        onSave={(input) => void onSave(input)}
      />
    );
  }

  const openToday = tasks.filter((task) => {
    const progress = taskProgress(task, checks);
    return !progress.doneToday && progress.count < progress.target;
  }).length;

  return (
    <div className="mx-auto max-w-[720px] pb-8">
      {tab === "tasks" ? (
        <LifeTasksScreen
          tasks={tasks}
          checks={checks}
          loading={loading}
          error={taskError}
          readonly={readonly}
          busy={busy}
          notice={notice}
          onToggle={toggleToday}
          onSave={onSaveTask}
          onRemove={removeTask}
          onEditingChange={setTaskEditing}
        />
      ) : tab === "settings" ? (
        <LifeSettingsScreen
          readonly={readonly}
          notice={notice}
          onFile={(dates, importedTasks) => {
            setNotice(
              dates.length || importedTasks.length
                ? ""
                : "No dates or tracked tasks in that file.",
            );
            setIncoming(dates.length || importedTasks.length ? { dates, tasks: importedTasks } : null);
          }}
        />
      ) : (
      <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.3px]">Dates</h1>
          <p className="text-[13px] text-otto-text-dim">Birthdays and the days around them</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            setEditingId(null);
            setEditing({
              ...EMPTY_LIFE_INPUT,
              month: today.getMonth() + 1,
              day: today.getDate(),
            });
          }}
          disabled={readonly}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-otto-text text-otto-bg disabled:opacity-40"
          aria-label="Add a date"
        >
          <Plus size={18} />
        </button>
      </div>

      {tasks.length > 0 && (
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className="mb-3 w-full rounded-2xl bg-otto-surface px-3 py-3 text-left"
        >
          <span className="block text-[14px] font-bold">Tracked today</span>
          <span className="text-[12px] text-otto-text-dim">
            {openToday ? `${openToday} still open` : "All done for today"}
          </span>
        </button>
      )}

      <div className="mb-4 overflow-x-auto">
        <div className="flex w-max gap-2">
          {(
            [
              ["all", "All"],
              ["birthday", "Birthdays"],
              ["anniversary", "Anniversaries"],
              ["holiday", "Holidays"],
              ["special", "Special"],
              ["milestones", "Milestones"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-bold ${
                filter === id ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3 py-2 text-xs text-otto-red">
          {error}
        </p>
      )}
      {notice && <p className="mb-3 text-[13px] text-otto-text-dim">{notice}</p>}

      {loading ? (
        <p className="text-sm text-otto-text-dim">Loading dates…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl bg-otto-surface px-4 py-8 text-center">
          <CalendarHeart className="mx-auto mb-2 text-otto-text-faint" size={28} />
          <p className="text-sm font-semibold">Nothing on this list yet</p>
          <p className="mt-1 text-[13px] text-otto-text-dim">
            Add a birthday here, or import dates from Settings.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-4">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              {group.label}
            </h2>
            <div className="overflow-hidden rounded-2xl bg-otto-surface">
              {group.rows.map(({ item, days }) => {
                const occasion = lifeOccasionLabel(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex w-full items-center gap-3 border-b border-otto-divider px-3 py-3 text-left last:border-b-0"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                      style={{ background: COLORS[item.category] }}
                    >
                      {initials(item.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-[15px] font-bold">{item.name}</span>
                        {item.milestone && <Star size={13} className="shrink-0 fill-current text-otto-amber" />}
                      </span>
                      <span className="block truncate text-[12px] text-otto-text-dim">
                        {[occasion, LIFE_CATEGORY_LABEL[item.category]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={`shrink-0 text-right font-extrabold ${item.milestone ? "text-[15px]" : "text-[13px]"}`}>
                      {lifeCountdownLabel(days)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
      </>
      )}

      {!editing && !taskEditing && <LifeBottomNav tab={tab} onTab={setTab} />}

      {incoming && (
        <ReviewSheet
          title={`Add ${[incoming.dates.length ? `${incoming.dates.length} dates` : "", incoming.tasks.length ? `${incoming.tasks.length} tasks` : ""].filter(Boolean).join(" and ")}?`}
          onClose={() => setIncoming(null)}
        >
          <ul className="mb-3 max-h-64 overflow-y-auto text-[13px]">
            {[...incoming.dates.map((item) => item.name), ...incoming.tasks.map((task) => task.name)]
              .slice(0, 12)
              .map((name, index) => (
                <li key={`${name}-${index}`} className="border-b border-otto-divider py-2">
                  {name}
                </li>
              ))}
            {incoming.dates.length + incoming.tasks.length > 12 && (
              <li className="py-2 text-otto-text-dim">
                and {incoming.dates.length + incoming.tasks.length - 12} more
              </li>
            )}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onImport()}
            className="w-full rounded-full bg-otto-text py-3 text-sm font-bold text-otto-bg disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add these"}
          </button>
        </ReviewSheet>
      )}

      {selected && (
        <ReviewSheet title={selected.name} onClose={() => setSelected(null)}>
          <p className="mb-3 text-[13px] text-otto-text-dim">
            {lifeCountdownLabel(lifeDaysUntil(selected))}
            {lifeOccasionLabel(selected) ? ` · ${lifeOccasionLabel(selected)}` : ""}
            {selected.notes ? ` · ${selected.notes}` : ""}
          </p>
          <SheetButton
            label={selected.milestone ? "Unmark milestone" : "Mark as milestone"}
            onClick={() => {
              void save({ ...toInput(selected), milestone: !selected.milestone }, selected.id)
                .then((saved) => setSelected(saved))
                .catch((err) => setNotice(err instanceof Error ? err.message : "Could not save."));
            }}
          />
          <SheetButton
            label="Edit"
            onClick={() => {
              setEditingId(selected.id);
              setEditing(toInput(selected));
              setSelected(null);
            }}
          />
          <SheetButton
            label="Delete"
            danger
            onClick={() => {
              void remove(selected.id)
                .then(() => setSelected(null))
                .catch((err) => setNotice(err instanceof Error ? err.message : "Could not delete."));
            }}
          />
        </ReviewSheet>
      )}
    </div>
  );
}

function toInput(item: LifeItem): LifeInput {
  return {
    name: item.name,
    category: item.category,
    notes: item.notes,
    month: item.month,
    day: item.day,
    year: item.year,
    occursOn: item.occursOn,
    repeats: item.repeats,
    remindDays: item.remindDays,
    milestone: item.milestone,
  };
}

function LifeEditor({
  initial,
  busy,
  notice,
  onCancel,
  onSave,
}: {
  initial: LifeInput;
  busy: boolean;
  notice: string;
  onCancel: () => void;
  onSave: (input: LifeInput) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [yearText, setYearText] = useState(initial.year ? String(initial.year) : "");
  const yearLabel = draft.category === "anniversary" ? "Started" : "Birth year";
  return (
    <div className="mx-auto max-w-[720px] pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold">Date</h1>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-otto-text-dim">
          Cancel
        </button>
      </div>
      <label className="mb-3 block text-[13px] font-semibold">
        Name
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="mt-1 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base font-normal"
        />
      </label>
      <div className="mb-3 flex flex-wrap gap-2">
        {LIFE_CATEGORIES.filter((category) => category !== "other").map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setDraft({ ...draft, category })}
            className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
              draft.category === category ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"
            }`}
          >
            {LIFE_CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>
      <label className="mb-3 block text-[13px] font-semibold">
        Date
        <input
          type="date"
          value={lifeDateInput(draft)}
          onChange={(event) => setDraft(applyLifeDate(event.target.value, draft))}
          className="mt-1 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base font-normal"
        />
      </label>
      <label className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
        <input
          type="checkbox"
          checked={draft.repeats === "yearly"}
          onChange={(event) => {
            const repeats = event.target.checked ? "yearly" : "once";
            const iso = lifeDateInput({ ...draft, repeats });
            setDraft(applyLifeDate(iso, { ...draft, repeats }));
          }}
          className="h-5 w-5 shrink-0"
        />
        Repeats every year
      </label>
      {(draft.category === "birthday" || draft.category === "anniversary") && (
        <label className="mb-3 block text-[13px] font-semibold">
          {yearLabel}
          <input
            inputMode="numeric"
            value={yearText}
            onChange={(event) => setYearText(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Optional"
            className="mt-1 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base font-normal"
          />
        </label>
      )}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Remind
      </p>
      <div className="mb-3 flex gap-2">
        {[0, 1, 3, 7].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setDraft({ ...draft, remindDays: days })}
            className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
              draft.remindDays === days ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"
            }`}
          >
            {days === 0 ? "Day of" : `${days}d`}
          </button>
        ))}
      </div>
      <label className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
        <input
          type="checkbox"
          checked={draft.milestone}
          onChange={(event) => setDraft({ ...draft, milestone: event.target.checked })}
          className="h-5 w-5 shrink-0"
        />
        Milestone countdown
      </label>
      <label className="mb-4 block text-[13px] font-semibold">
        Note
        <textarea
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          rows={3}
          className="mt-1 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base font-normal"
        />
      </label>
      {notice && <p className="mb-3 text-[13px] text-otto-red">{notice}</p>}
      <button
        type="button"
        disabled={busy || !draft.name.trim()}
        onClick={() => {
          const year = Number(yearText);
          onSave({
            ...draft,
            year: yearText.length === 4 && year >= 1900 && year <= 2100 ? year : null,
          });
        }}
        className="w-full rounded-full bg-otto-text py-3 text-sm font-bold text-otto-bg disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function ReviewSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 desk:items-center"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-[720px] rounded-t-[28px] bg-otto-bg p-4 desk:rounded-[24px]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-otto-text-dim">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SheetButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-2 w-full rounded-2xl bg-otto-surface px-3 py-3 text-left text-sm font-bold ${
        danger ? "text-otto-red" : ""
      }`}
    >
      {label}
    </button>
  );
}
