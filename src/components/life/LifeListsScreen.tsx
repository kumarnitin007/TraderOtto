"use client";

import { useState } from "react";
import { CalendarCheck, Check, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionSheet, SheetAction } from "@/components/ui/ActionSheet";
import type { LifeList, LifeListItem, LifeListItemInput } from "@/types/life";

export function LifeListsScreen({
  lists,
  items,
  loading,
  error,
  readonly,
  notice,
  onSaveList,
  onRemoveList,
  onSaveItem,
  onRemoveItem,
}: {
  lists: LifeList[];
  items: LifeListItem[];
  loading: boolean;
  error: string;
  readonly: boolean;
  notice: string;
  onSaveList: (name: string, id?: string) => Promise<void>;
  onRemoveList: (id: string) => Promise<void>;
  onSaveItem: (input: LifeListItemInput, id?: string) => Promise<void>;
  onRemoveItem: (id: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [listName, setListName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedList, setSelectedList] = useState<LifeList | null>(null);
  const [rename, setRename] = useState("");
  const [selectedItem, setSelectedItem] = useState<LifeListItem | null>(null);
  const [dueOn, setDueOn] = useState("");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.3px]">To-dos</h1>
          <p className="text-[13px] text-otto-text-dim">One-off items, organized into lists</p>
        </div>
        <button
          type="button"
          disabled={readonly}
          onClick={() => setAdding((current) => !current)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-otto-text text-otto-bg disabled:opacity-40"
          aria-label="Add a list"
        >
          <Plus size={18} />
        </button>
      </div>
      {adding && (
        <form
          className="mb-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = listName.trim();
            if (!name) return;
            void onSaveList(name).then(() => {
              setListName("");
              setAdding(false);
            });
          }}
        >
          <input
            value={listName}
            onChange={(event) => setListName(event.target.value)}
            placeholder="List name"
            className="w-0 min-w-0 flex-1 rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base"
          />
          <button
            type="submit"
            disabled={!listName.trim()}
            className="rounded-full bg-otto-text px-4 text-sm font-bold text-otto-bg disabled:opacity-40"
          >
            Add
          </button>
        </form>
      )}
      {error && (
        <p className="mb-3 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3 py-2 text-xs text-otto-red">
          {error}
        </p>
      )}
      {notice && <p className="mb-3 text-[13px] text-otto-text-dim">{notice}</p>}
      {loading ? (
        <p className="text-sm text-otto-text-dim">Loading lists…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl bg-otto-surface px-4 py-8 text-center">
          <p className="text-sm font-semibold">No lists yet</p>
          <p className="mt-1 text-[13px] text-otto-text-dim">Add a list for groceries, errands, or anything else.</p>
        </div>
      ) : (
        lists.map((list) => {
          const rows = items
            .filter((item) => item.listId === list.id)
            .sort((left, right) => Number(left.done) - Number(right.done) || left.createdAt.localeCompare(right.createdAt));
          const open = rows.filter((item) => !item.done).length;
          return (
            <section key={list.id} className="mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedList(list);
                  setRename(list.name);
                }}
                className="mb-2 flex w-full items-baseline justify-between text-left"
              >
                <span className="text-[15px] font-extrabold">{list.name}</span>
                <span className="text-[12px] text-otto-text-dim">{open} open</span>
              </button>
              <div className="overflow-hidden rounded-2xl bg-otto-surface">
                {rows.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border-b border-otto-divider px-3 py-3">
                    <button
                      type="button"
                      disabled={readonly}
                      aria-label={item.done ? `Undo ${item.text}` : `Mark ${item.text} done`}
                      onClick={() =>
                        void onSaveItem(
                          { listId: item.listId, text: item.text, done: !item.done, dueOn: item.dueOn },
                          item.id,
                        )
                      }
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        item.done ? "border-otto-green bg-otto-green text-white" : "border-otto-divider text-transparent"
                      }`}
                    >
                      <Check size={15} />
                    </button>
                    <button type="button" onClick={() => {
                      setSelectedItem(item);
                      setDueOn(item.dueOn ?? "");
                    }} className="min-w-0 flex-1 text-left">
                      <span className={`block truncate text-[15px] ${item.done ? "text-otto-text-dim line-through" : "font-semibold"}`}>
                        {item.text}
                      </span>
                      {item.dueOn && !item.done && (
                        <span className="block text-[12px] text-otto-text-dim">Due {item.dueOn}</span>
                      )}
                    </button>
                  </div>
                ))}
                <form
                  className="flex gap-2 px-3 py-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = (drafts[list.id] ?? "").trim();
                    if (!text) return;
                    void onSaveItem({ listId: list.id, text, done: false, dueOn: null }).then(() => {
                      setDrafts((current) => ({ ...current, [list.id]: "" }));
                    });
                  }}
                >
                  <input
                    value={drafts[list.id] ?? ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [list.id]: event.target.value }))}
                    placeholder="Add an item"
                    className="w-0 min-w-0 flex-1 bg-transparent py-2 text-base"
                  />
                  <button type="submit" className="text-[13px] font-bold text-otto-text-dim" aria-label={`Add item to ${list.name}`}>
                    Add
                  </button>
                </form>
              </div>
            </section>
          );
        })
      )}

      {selectedList && (
        <ActionSheet
          title={selectedList.name}
          subtitle={`${items.filter((item) => item.listId === selectedList.id && !item.done).length} open`}
          icon={ListTodo}
          onClose={() => setSelectedList(null)}
        >
          <div className="px-3 pb-1">
            <input
              value={rename}
              onChange={(event) => setRename(event.target.value)}
              aria-label="List name"
              className="w-full rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base"
            />
          </div>
          <SheetAction
            icon={Pencil}
            label="Rename"
            onClick={() => {
              if (!rename.trim()) return;
              void onSaveList(rename.trim(), selectedList.id).then(() => setSelectedList(null));
            }}
          />
          <SheetAction
            icon={Trash2}
            label="Delete list"
            tone="danger"
            onClick={() => {
              void onRemoveList(selectedList.id).then(() => setSelectedList(null));
            }}
          />
        </ActionSheet>
      )}

      {selectedItem && (
        <ActionSheet
          title={selectedItem.text}
          subtitle={selectedItem.dueOn ? `Due ${selectedItem.dueOn}` : "No due date"}
          icon={ListTodo}
          onClose={() => setSelectedItem(null)}
        >
          <label className="mb-1 block px-3 text-[13px] font-semibold">
            Due date
            <input
              type="date"
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
              className="mt-1 w-full rounded-xl border border-otto-divider bg-otto-surface px-3 py-2.5 text-base font-normal"
            />
          </label>
          <SheetAction
            icon={CalendarCheck}
            label="Save date"
            onClick={() => {
              void onSaveItem(
                {
                  listId: selectedItem.listId,
                  text: selectedItem.text,
                  done: selectedItem.done,
                  dueOn: dueOn || null,
                },
                selectedItem.id,
              ).then(() => setSelectedItem(null));
            }}
          />
          <SheetAction
            icon={Check}
            label={selectedItem.done ? "Mark as open" : "Mark as done"}
            onClick={() => {
              void onSaveItem(
                {
                  listId: selectedItem.listId,
                  text: selectedItem.text,
                  done: !selectedItem.done,
                  dueOn: selectedItem.dueOn,
                },
                selectedItem.id,
              ).then(() => setSelectedItem(null));
            }}
          />
          <SheetAction
            icon={Trash2}
            label="Delete item"
            tone="danger"
            onClick={() => {
              void onRemoveItem(selectedItem.id).then(() => setSelectedItem(null));
            }}
          />
        </ActionSheet>
      )}
    </div>
  );
}
