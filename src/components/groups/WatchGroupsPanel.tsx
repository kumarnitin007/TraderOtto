"use client";

import { useState } from "react";
import { FolderPlus, Plus, Trash2, X } from "lucide-react";
import { useWatchGroups } from "@/hooks/useWatchGroups";

export function WatchGroupsPanel() {
  const {
    groups,
    addGroup,
    renameGroup,
    deleteGroup,
    addTracker,
    updateTracker,
    removeTracker,
  } = useWatchGroups();
  const [name, setName] = useState("");
  const [tickerByGroup, setTickerByGroup] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function createGroup() {
    if (!name.trim()) return;
    addGroup(name);
    setName("");
  }

  return (
    <div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-otto-text-faint">
        Create tracker groups for tickers you may trade. Groups appear in the selector at the top
        of Positions.
      </p>

      <div className="flex items-end gap-2 rounded-xl bg-otto-surface px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-otto-text-dim">Group name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && createGroup()}
            placeholder="Tech earnings"
          />
        </div>
        <button
          type="button"
          onClick={createGroup}
          disabled={!name.trim()}
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
        {groups.map((group) => (
          <section key={group.id} className="rounded-xl border border-otto-divider p-3.5">
            <div className="flex items-center gap-2">
              <input
                value={group.name}
                onChange={(event) => renameGroup(group.id, event.target.value)}
                className="font-bold"
                aria-label="Group name"
              />
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
                      <span className="font-bold">{tracker.ticker}</span>
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
          </section>
        ))}
      </div>
    </div>
  );
}
