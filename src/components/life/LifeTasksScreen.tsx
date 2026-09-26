"use client";

import { useEffect, useState } from "react";
import { Check, CheckCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionSheet, SheetAction } from "@/components/ui/ActionSheet";
import { recentDayDots, taskProgress } from "@/lib/lifeTasks";
import type { LifeTask, LifeTaskCheck, LifeTaskInput } from "@/types/life";
import { EMPTY_LIFE_TASK } from "@/types/life";

export function LifeTasksScreen({
  tasks,
  checks,
  loading,
  error,
  readonly,
  busy,
  notice,
  onToggle,
  onSave,
  onRemove,
  onEditingChange,
}: {
  tasks: LifeTask[];
  checks: LifeTaskCheck[];
  loading: boolean;
  error: string;
  readonly: boolean;
  busy: boolean;
  notice: string;
  onToggle: (taskId: string) => Promise<void>;
  onSave: (input: LifeTaskInput, id?: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<LifeTaskInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<LifeTask | null>(null);
  useEffect(() => {
    onEditingChange?.(editing !== null);
  }, [editing, onEditingChange]);
  const openCount = tasks.filter((task) => {
    const progress = taskProgress(task, checks);
    return !progress.doneToday && progress.count < progress.target;
  }).length;

  if (editing) {
    return (
      <TaskEditor
        initial={editing}
        busy={busy}
        notice={notice}
        onCancel={() => {
          setEditing(null);
          setEditingId(null);
        }}
        onSave={(input) => {
          void onSave(input, editingId ?? undefined)
            .then(() => {
              setEditing(null);
              setEditingId(null);
            })
            .catch(() => undefined);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.3px]">Habits</h1>
          <p className="text-[13px] text-otto-text-dim">
            {tasks.length ? `${openCount} still open today` : "Habits you check off"}
          </p>
        </div>
        <button
          type="button"
          disabled={readonly}
          onClick={() => {
            setEditingId(null);
            setEditing(EMPTY_LIFE_TASK);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-otto-text text-otto-bg disabled:opacity-40"
          aria-label="Add a habit"
        >
          <Plus size={18} />
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3 py-2 text-xs text-otto-red">
          {error}
        </p>
      )}
      {notice && <p className="mb-3 text-[13px] text-otto-text-dim">{notice}</p>}
      {loading ? (
        <p className="text-sm text-otto-text-dim">Loading habits…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl bg-otto-surface px-4 py-8 text-center">
          <p className="text-sm font-semibold">No habits yet</p>
          <p className="mt-1 text-[13px] text-otto-text-dim">
            Add a daily habit, or import them from Settings.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-otto-surface">
          {tasks.map((task) => {
            const progress = taskProgress(task, checks);
            const met = progress.count >= progress.target;
            return (
              <div key={task.id} className="flex items-center gap-3 border-b border-otto-divider px-3 py-3 last:border-b-0">
                <button
                  type="button"
                  aria-label={progress.doneToday ? `Undo ${task.name}` : `Mark ${task.name} done today`}
                  disabled={readonly}
                  onClick={() => void onToggle(task.id)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                    progress.doneToday
                      ? "border-otto-green bg-otto-green text-white"
                      : "border-otto-divider text-transparent"
                  }`}
                >
                  <Check size={16} />
                </button>
                <button type="button" onClick={() => setSelected(task)} className="min-w-0 flex-1 text-left">
                  <span className={`block truncate text-[15px] font-bold ${met ? "text-otto-text-dim" : ""}`}>
                    {task.name}
                  </span>
                  <span className="block truncate text-[12px] text-otto-text-dim">{progress.label}</span>
                  {task.cadence === "daily" ? (
                    <span className="mt-1 flex gap-1">
                      {recentDayDots(task.id, checks).map((dot) => (
                        <span
                          key={dot.doneOn}
                          className={`h-1.5 w-1.5 rounded-full ${dot.done ? "bg-otto-green" : "bg-otto-divider"}`}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-otto-divider">
                      <span
                        className="block h-full bg-otto-green"
                        style={{ width: `${Math.min(100, (progress.count / progress.target) * 100)}%` }}
                      />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {selected && (
        <ActionSheet
          title={selected.name}
          subtitle={
            selected.notes ||
            (selected.cadence === "daily"
              ? "Every day"
              : `${selected.targetCount} a week`)
          }
          icon={CheckCheck}
          onClose={() => setSelected(null)}
        >
          <SheetAction
            icon={Check}
            label={taskProgress(selected, checks).doneToday ? "Undo today" : "Mark done today"}
            onClick={() => {
              void onToggle(selected.id).then(() => setSelected(null));
            }}
          />
          <SheetAction
            icon={Pencil}
            label="Edit"
            onClick={() => {
              setEditingId(selected.id);
              setEditing({
                name: selected.name,
                notes: selected.notes,
                cadence: selected.cadence,
                targetCount: selected.targetCount,
              });
              setSelected(null);
            }}
          />
          <SheetAction
            icon={Trash2}
            label="Delete"
            tone="danger"
            onClick={() => {
              void onRemove(selected.id).then(() => setSelected(null));
            }}
          />
        </ActionSheet>
      )}
    </div>
  );
}

function TaskEditor({
  initial,
  busy,
  notice,
  onCancel,
  onSave,
}: {
  initial: LifeTaskInput;
  busy: boolean;
  notice: string;
  onCancel: () => void;
  onSave: (input: LifeTaskInput) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const weekly = draft.cadence === "weekly";
  const choices = [2, 3, 5, ...(weekly && ![2, 3, 5].includes(draft.targetCount) ? [draft.targetCount] : [])].sort(
    (left, right) => left - right,
  );
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold">Habit</h1>
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
        <button
          type="button"
          onClick={() => setDraft({ ...draft, cadence: "daily", targetCount: 1 })}
          className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
            !weekly ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-dim"
          }`}
        >
          Every day
        </button>
        {choices.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => setDraft({ ...draft, cadence: "weekly", targetCount: count })}
            className={`rounded-full px-3.5 py-2 text-[12px] font-bold ${
              weekly && draft.targetCount === count
                ? "bg-otto-text text-otto-bg"
                : "bg-otto-surface text-otto-text-dim"
            }`}
          >
            {count} a week
          </button>
        ))}
      </div>
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
        onClick={() => onSave(draft)}
        className="w-full rounded-full bg-otto-text py-3 text-sm font-bold text-otto-bg disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
