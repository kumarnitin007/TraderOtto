"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  coverPatchFromSearch,
  planLibraryCleanup,
  type CleanupAction,
} from "@/lib/bookCleanup";
import type { Book, BookInput, OpenLibraryBook } from "@/types/book";

async function lookupCover(book: Book): Promise<Partial<BookInput> | null> {
  const query = (book.isbn || `${book.title} ${book.author}`).trim().slice(0, 180);
  if (query.length < 2) return null;
  const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { books?: OpenLibraryBook[] };
  return coverPatchFromSearch(book, data.books ?? []);
}

export function LibraryCheck({
  books,
  openLibraryEnabled,
  onApply,
}: {
  books: Book[];
  openLibraryEnabled: boolean;
  onApply: (actions: CleanupAction[]) => Promise<void>;
}) {
  const [actions, setActions] = useState<CleanupAction[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [note, setNote] = useState("");

  async function check() {
    setChecking(true);
    setNote("");
    try {
      const next = planLibraryCleanup(books);
      const covered = new Set(
        next.filter((action) => action.patch?.coverId).map((action) => action.bookId),
      );
      const missing = books.filter((book) => !book.coverId && !covered.has(book.id));
      const batch = openLibraryEnabled ? missing.slice(0, 20) : [];
      for (const book of batch) {
        const patch = await lookupCover(book);
        if (!patch) continue;
        const existing = next.find((action) => action.kind === "update" && action.bookId === book.id);
        if (existing?.patch) {
          existing.patch = { ...existing.patch, ...patch };
          existing.summary = `${existing.summary} Also fill the cover.`;
        } else {
          next.push({
            id: `lookup:${book.id}`,
            bookId: book.id,
            title: book.title,
            kind: "update",
            summary: "Fill the cover and any missing details from Open Library.",
            patch,
          });
        }
      }
      setActions(next);
      setPicked(Object.fromEntries(next.map((action) => [action.id, true])));
      const leftover = missing.length - batch.length;
      setNote(
        next.length
          ? leftover > 0
            ? `Checked ${batch.length} books still missing a cover. ${leftover} are left for the next check.`
            : ""
          : "No duplicates or missing covers to fix.",
      );
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "Could not check the library.");
    } finally {
      setChecking(false);
    }
  }

  async function apply() {
    if (!actions) return;
    const selected = actions.filter((action) => picked[action.id]);
    if (!selected.length) return;
    setApplying(true);
    setNote("");
    try {
      await onApply(selected);
      setActions(null);
      setNote("Library updated.");
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : "Could not apply those changes.");
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = actions?.filter((action) => picked[action.id]).length ?? 0;

  return (
    <details className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
        <ShieldCheck size={18} className="text-otto-text-dim" />
        <span>
          <b className="block text-[14px]">Check library</b>
          <span className="text-[12px] text-otto-text-dim">Duplicates and missing covers</span>
        </span>
      </summary>
      <div className="border-t border-otto-divider px-3.5 py-3">
        <p className="mb-3 text-[13px] text-otto-text-dim">
          Find duplicate books and fill missing covers. Nothing is saved until you apply a selection.
        </p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking || !books.length}
          className="rounded-full bg-otto-text px-4 py-2 text-[13px] font-bold text-otto-bg disabled:opacity-40"
        >
          {checking ? "Checking…" : "Check library"}
        </button>
        {note && <p className="mt-3 text-[13px] text-otto-text-dim">{note}</p>}
        {actions && actions.length > 0 && (
          <div className="mt-3">
            {actions.map((action) => (
              <label key={action.id} className="flex items-start gap-2 border-t border-otto-divider py-2">
                <input
                  type="checkbox"
                  checked={picked[action.id] ?? false}
                  onChange={(event) =>
                    setPicked((current) => ({ ...current, [action.id]: event.target.checked }))
                  }
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold">{action.title}</span>
                  <span className="block text-[12px] text-otto-text-dim">{action.summary}</span>
                </span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => void apply()}
              disabled={applying || !selectedCount}
              className="mt-3 w-full rounded-full bg-otto-text py-3 text-sm font-bold text-otto-bg disabled:opacity-40"
            >
              {applying ? "Saving…" : `Apply ${selectedCount} selected`}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
