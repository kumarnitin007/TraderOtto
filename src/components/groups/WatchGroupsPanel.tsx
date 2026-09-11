"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, FolderPlus, Plus, Trash2, X } from "lucide-react";
import { useEnsureGroupEarnings } from "@/hooks/useEnsureGroupEarnings";
import { useScreenOption } from "@/hooks/useScreenOption";
import { useWatchGroups } from "@/hooks/useWatchGroups";

export function WatchGroupsPanel() {
  const {
    groups,
    addGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    addTracker,
    updateTracker,
    removeTracker,
    readonly,
    error,
  } = useWatchGroups();
  useEnsureGroupEarnings(groups);
  const [name, setName] = useState("");
  const [tickerByGroup, setTickerByGroup] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useScreenOption("collapsedGroups");

  const [actionError, setActionError] = useState("");

  async function createGroup() {
    if (!name.trim()) return;
    if (readonly) {
      setActionError("Sign in to create database-backed groups.");
      return;
    }
    try {
      await addGroup(name);
      setName("");
      setActionError("");
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Could not create group."
      );
    }
  }

  return (
    <div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-otto-text-faint">
        Create tracker groups for tickers you may trade. Use the arrows to set list order — Positions uses the same order.
      </p>
      {(error || actionError) && (
        <div className="mb-3 rounded-lg bg-otto-red-soft px-3 py-2 text-xs text-otto-red">
          {error || actionError}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl bg-otto-surface px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-otto-text-dim">Group name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) =>
              event.key === "Enter" && void createGroup()
            }
            placeholder="Tech earnings"
          />
        </div>
        <button
          type="button"
          onClick={() => void createGroup()}
          disabled={!name.trim() || readonly}
          className="mb-1 flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-otto-green px-4 text-xs font-bold text-black disabled:opacity-40"
        >
          <FolderPlus size={15} />
          Create
        </button>
      </div>

      {groups.length === 0 && (
        <div className="py-10 text-center text-sm text-otto-text-faint">
          No tracker groups yet.
        </div>
      )}

      <div className="mt-4 space-y-4">
        {groups.map((group, index) => {
          const isCollapsed = Boolean(collapsed[group.id]);
          return (
          <section key={group.id} className="rounded-xl border border-otto-divider p-3.5">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => moveGroup(group.id, -1)}
                  disabled={index === 0 || readonly}
                  className="flex h-5 w-7 items-center justify-center text-otto-text-dim disabled:opacity-25"
                  aria-label={`Move ${group.name} up`}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveGroup(group.id, 1)}
                  disabled={index === groups.length - 1 || readonly}
                  className="flex h-5 w-7 items-center justify-center text-otto-text-dim disabled:opacity-25"
                  aria-label={`Move ${group.name} down`}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((current) => ({
                    ...current,
                    [group.id]: !current[group.id],
                  }))
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-otto-text-dim"
                aria-expanded={!isCollapsed}
                aria-label={isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
              >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>
              <input
                value={group.name}
                onChange={(event) => renameGroup(group.id, event.target.value)}
                className="font-bold"
                aria-label="Group name"
              />
              <span className="shrink-0 text-[11px] text-otto-text-faint">
                {group.trackers.length} ticker{group.trackers.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() =>
                  confirmDelete === group.id
                    ? deleteGroup(group.id)
                    : setConfirmDelete(group.id)
                }
                className={`flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${
                  confirmDelete === group.id
                    ? "border-otto-red bg-otto-red-soft text-otto-red"
                    : "border-otto-divider text-otto-text-faint"
                }`}
              >
                <Trash2 size={13} />
                {confirmDelete === group.id ? "Confirm" : "Delete"}
              </button>
            </div>

            {isCollapsed ? null : (
            <>
            <div className="mt-3 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-[11px] text-otto-text-faint">Add ticker</label>
                <input
                  value={tickerByGroup[group.id] ?? ""}
                  onChange={(event) =>
                    setTickerByGroup((current) => ({
                      ...current,
                      [group.id]: event.target.value.toUpperCase(),
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    addTracker(group.id, tickerByGroup[group.id] ?? "");
                    setTickerByGroup((current) => ({ ...current, [group.id]: "" }));
                  }}
                  placeholder="AAPL"
                  className="uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  addTracker(group.id, tickerByGroup[group.id] ?? "");
                  setTickerByGroup((current) => ({ ...current, [group.id]: "" }));
                }}
                className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-otto-green text-black"
                aria-label="Add ticker"
              >
                <Plus size={17} />
              </button>
            </div>

            {group.trackers.length === 0 ? (
              <div className="mt-4 text-center text-xs text-otto-text-faint">
                Add tickers to start watching this group.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {group.trackers.map((tracker) => (
                  <div key={tracker.id} className="rounded-lg bg-otto-surface px-3 py-2.5">
                    <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-bold">{tracker.ticker}</span>
                      {tracker.sector && (
                        <span className="truncate text-[11px] font-medium text-otto-text-dim">
                          {tracker.sector}
                        </span>
                      )}
                    </div>
                      <button
                        type="button"
                        onClick={() => removeTracker(group.id, tracker.id)}
                        className="text-otto-text-faint"
                        aria-label={`Remove ${tracker.ticker}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <label className="text-[10.5px] text-otto-text-faint">
                        Alert below
                        <input
                          type="number"
                          value={tracker.lowerTrigger ?? ""}
                          onChange={(event) =>
                            updateTracker(group.id, tracker.id, {
                              lowerTrigger: event.target.value
                                ? Number(event.target.value)
                                : null,
                            })
                          }
                          placeholder="No lower limit"
                        />
                      </label>
                      <label className="text-[10.5px] text-otto-text-faint">
                        Alert above
                        <input
                          type="number"
                          value={tracker.upperTrigger ?? ""}
                          onChange={(event) =>
                            updateTracker(group.id, tracker.id, {
                              upperTrigger: event.target.value
                                ? Number(event.target.value)
                                : null,
                            })
                          }
                          placeholder="No upper limit"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </section>
          );
        })}
      </div>
    </div>
  );
}
