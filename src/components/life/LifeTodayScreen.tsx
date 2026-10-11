"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, CircleCheckBig, Star } from "lucide-react";
import {
  LIFE_CATEGORY_LABEL,
  lifeCountdownLabel,
  lifeDaysUntil,
  lifeMilestones,
  lifeOccasionLabel,
  MILESTONE_SNOOZE_EVENT,
  MILESTONE_WINDOWS,
  milestoneSnoozed,
  startOfDay,
  type MilestoneWindow,
} from "@/lib/life";
import { useScreenOption } from "@/hooks/useScreenOption";
import { dueListItems } from "@/lib/lifeLists";
import { isoDay, recentDayDots, taskProgress } from "@/lib/lifeTasks";
import type {
  LifeItem,
  LifeList,
  LifeListItem,
  LifeTask,
  LifeTaskCheck,
} from "@/types/life";

export function LifeTodayScreen({
  dates,
  tasks,
  checks,
  lists,
  listItems,
  loading,
  errors,
  readonly,
  notice,
  onDate,
  onToggleTask,
  onToggleListItem,
  onOpenDates,
  onOpenTasks,
  onOpenLists,
}: {
  dates: LifeItem[];
  tasks: LifeTask[];
  checks: LifeTaskCheck[];
  lists: LifeList[];
  listItems: LifeListItem[];
  loading: boolean;
  errors: string[];
  readonly: boolean;
  notice: string;
  onDate: (item: LifeItem) => void;
  onToggleTask: (taskId: string, doneOn: string) => Promise<void>;
  onToggleListItem: (item: LifeListItem) => Promise<void>;
  onOpenDates: () => void;
  onOpenTasks: () => void;
  onOpenLists: () => void;
}) {
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [milestoneWindow, setMilestoneWindow] = useScreenOption("lifeMilestoneWindow");
  const [snoozeTick, setSnoozeTick] = useState(0);
  useEffect(() => {
    const refresh = () => setSnoozeTick((current) => current + 1);
    window.addEventListener(MILESTONE_SNOOZE_EVENT, refresh);
    return () => window.removeEventListener(MILESTONE_SNOOZE_EVENT, refresh);
  }, []);
  const now = day;
  const viewingToday = isoDay(day) === isoDay(new Date());
  const dateRows = dates
    .map((item) => ({ item, days: lifeDaysUntil(item, now) }))
    .filter(({ item, days }) => days >= 0 && days <= item.remindDays)
    .sort((left, right) => left.days - right.days || left.item.name.localeCompare(right.item.name));
  const milestones = useMemo(
    () =>
      lifeMilestones(dates, milestoneWindow, now).filter(
        ({ item }) => !milestoneSnoozed(item.id, now),
      ),
    [dates, milestoneWindow, now, snoozeTick],
  );
  const dueItems = dueListItems(listItems, now);
  const todayIso = isoDay(now);
  const completedTodosToday = listItems.filter(
    (item) =>
      item.done &&
      item.dueOn &&
      item.dueOn <= todayIso &&
      item.updatedAt.slice(0, 10) === todayIso,
  ).length;
  const listNames = new Map(lists.map((list) => [list.id, list.name]));
  const doneToday = tasks.filter((task) => taskProgress(task, checks, now).doneToday).length;
  const totalActions = tasks.length + dueItems.length + completedTodosToday;
  const completedActions = doneToday + completedTodosToday;
  const percent = totalActions ? Math.round((completedActions / totalActions) * 100) : 100;
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDay((current) => shiftDay(current, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="text-[22px] font-extrabold tracking-[-0.3px]">
            {viewingToday ? "Today" : dateLabel}
          </h1>
          <input
            type="date"
            value={isoDay(day)}
            onChange={(event) => {
              const next = event.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(next)) {
                const [year, month, date] = next.split("-").map(Number);
                setDay(new Date(year, month - 1, date));
              }
            }}
            aria-label="Choose a day"
            className="bg-transparent text-center text-[13px] text-otto-text-dim"
          />
        </div>
        <button
          type="button"
          onClick={() => setDay((current) => shiftDay(current, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {!viewingToday && (
        <button
          type="button"
          onClick={() => setDay(startOfDay(new Date()))}
          className="mb-4 text-[13px] font-bold text-otto-text-dim"
        >
          Back to today
        </button>
      )}

      {errors.map((message) => (
        <p
          key={message}
          className="mb-3 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3 py-2 text-xs text-otto-red"
        >
          {message}
        </p>
      ))}
      {notice && <p className="mb-3 text-[13px] text-otto-text-dim">{notice}</p>}

      {loading ? (
        <p className="text-sm text-otto-text-dim">Loading today…</p>
      ) : (
        <>
          <section className="mb-4 rounded-2xl bg-otto-surface px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
                  Daily progress
                </p>
                <p className="mt-0.5 text-[15px] font-extrabold">
                  {totalActions
                    ? `${completedActions} of ${totalActions} checked`
                    : viewingToday
                      ? "Nothing waiting today"
                      : "Nothing waiting"}
                </p>
              </div>
              <span className="text-xl font-extrabold text-otto-green">{percent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-otto-divider">
              <span
                className="block h-full rounded-full bg-otto-green transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </section>

          <section className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[13px] font-extrabold">Milestones</span>
              <div className="flex rounded-full bg-otto-surface p-1">
                {MILESTONE_WINDOWS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={milestoneWindow === days}
                    onClick={() => setMilestoneWindow(days as MilestoneWindow)}
                    className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                      milestoneWindow === days
                        ? "bg-otto-text text-otto-bg"
                        : "text-otto-text-dim"
                    }`}
                  >
                    {days === 365 ? "1y" : `${days}d`}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-otto-surface">
              {milestones.length ? (
                milestones.map(({ item, days }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onDate(item)}
                    className="flex w-full items-center gap-3 border-b border-otto-divider px-4 py-3 text-left last:border-b-0"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-amber-soft text-otto-amber">
                      <Star size={16} className="fill-current" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-extrabold">
                        {item.name}
                      </span>
                      <span className="block truncate text-[12px] text-otto-text-dim">
                        {[lifeOccasionLabel(item, now), LIFE_CATEGORY_LABEL[item.category]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[13px] font-extrabold">
                      {lifeCountdownLabel(days)}
                    </span>
                  </button>
                ))
              ) : (
                <EmptyRow text={`No milestones in the next ${milestoneWindow === 365 ? "year" : `${milestoneWindow} days`}`} />
              )}
            </div>
          </section>

          <TodaySection title="Dates" count={dateRows.length} onOpen={onOpenDates}>
            {dateRows.length ? (
              dateRows.map(({ item, days }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDate(item)}
                  className="flex w-full items-center gap-3 border-b border-otto-divider px-3 py-3 text-left last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{item.name}</span>
                    <span className="block truncate text-[12px] text-otto-text-dim">
                      {[lifeOccasionLabel(item, now), LIFE_CATEGORY_LABEL[item.category]]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-extrabold">
                    {lifeCountdownLabel(days)}
                  </span>
                </button>
              ))
            ) : (
              <EmptyRow text={viewingToday ? "No date reminders today" : "No date reminders"} />
            )}
          </TodaySection>

          <TodaySection title="Habits" count={tasks.length} onOpen={onOpenTasks}>
            {tasks.length ? (
              tasks.map((task) => {
                const progress = taskProgress(task, checks, now);
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 border-b border-otto-divider px-3 py-3 last:border-b-0"
                  >
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => void onToggleTask(task.id, isoDay(day))}
                      aria-label={progress.doneToday ? `Undo ${task.name}` : `Mark ${task.name} done`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        progress.doneToday
                          ? "border-otto-green bg-otto-green text-white"
                          : "border-otto-divider text-transparent"
                      }`}
                    >
                      <Check size={16} />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[15px] font-bold ${
                          progress.doneToday ? "text-otto-text-dim" : ""
                        }`}
                      >
                        {task.name}
                      </span>
                      <span className="block text-[12px] text-otto-text-dim">
                        {viewingToday || task.cadence === "weekly"
                          ? progress.label
                          : progress.doneToday
                            ? "Done"
                            : "Not done"}
                      </span>
                      {task.cadence === "daily" && (
                        <span className="mt-1 flex gap-1">
                          {recentDayDots(task.id, checks, now).map((dot) => (
                            <span
                              key={dot.doneOn}
                              className={`h-1.5 w-1.5 rounded-full ${
                                dot.done ? "bg-otto-green" : "bg-otto-divider"
                              }`}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <EmptyRow text="No habits yet" />
            )}
          </TodaySection>

          <TodaySection title="To-dos" count={dueItems.length} onOpen={onOpenLists}>
            {dueItems.length ? (
              dueItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-otto-divider px-3 py-3 last:border-b-0"
                >
                  <button
                    type="button"
                    disabled={readonly}
                    onClick={() => void onToggleListItem(item)}
                    aria-label={`Complete ${item.text}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-otto-divider text-transparent"
                  >
                    <Check size={16} />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{item.text}</span>
                    <span className="block text-[12px] text-otto-text-dim">
                      {listNames.get(item.listId) ?? "To-dos"} · Due {item.dueOn}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <EmptyRow text="No due or overdue to-dos" done />
            )}
          </TodaySection>
        </>
      )}
    </div>
  );
}

function shiftDay(date: Date, count: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + count);
  return next;
}

function TodaySection({
  title,
  count,
  onOpen,
  children,
}: {
  title: string;
  count: number;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={onOpen}
        className="mb-2 flex w-full items-center justify-between text-left"
      >
        <span className="text-[13px] font-extrabold">{title}</span>
        <span className="flex items-center gap-1 text-[12px] text-otto-text-dim">
          {count}
          <ChevronRight size={14} />
        </span>
      </button>
      <div className="overflow-hidden rounded-2xl bg-otto-surface">{children}</div>
    </section>
  );
}

function EmptyRow({ text, done }: { text: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 text-[13px] text-otto-text-dim">
      {done && <CircleCheckBig size={16} className="text-otto-green" />}
      {text}
    </div>
  );
}
