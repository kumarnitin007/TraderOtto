"use client";

import { FormEvent, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { BookCover } from "@/components/books/BookCover";
import { authHeaders } from "@/lib/authHeaders";
import { bookCoverColor, validateBook } from "@/lib/books";
import type {
  Book,
  BookFormat,
  BookInput,
  BookStatus,
  OpenLibraryBook,
} from "@/types/book";

const inputClass =
  "w-full rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[14px]";

function initialValue(book?: Book): BookInput {
  return book
    ? {
        title: book.title,
        author: book.author,
        status: book.status,
        progressPercent: book.progressPercent,
        rating: book.rating,
        wouldRecommend: book.wouldRecommend,
        format: book.format,
        pageCount: book.pageCount,
        durationMinutes: book.durationMinutes,
        startedAt: book.startedAt,
        finishedAt: book.finishedAt,
        notes: book.notes,
        tags: book.tags,
        seriesTitle: book.seriesTitle,
        seriesIndex: book.seriesIndex,
        isbn: book.isbn,
        openLibraryId: book.openLibraryId,
        coverId: book.coverId,
        coverColor: book.coverColor,
      }
    : {
        title: "",
        author: "",
        status: "want_to_read",
        progressPercent: 0,
        rating: 0,
        wouldRecommend: null,
        format: "print",
        pageCount: null,
        durationMinutes: null,
        startedAt: null,
        finishedAt: null,
        notes: "",
        tags: [],
        seriesTitle: "",
        seriesIndex: null,
        isbn: "",
        openLibraryId: "",
        coverId: null,
        coverColor: "#4d8069",
      };
}

export function BookEditor({
  book,
  openLibraryEnabled,
  onClose,
  onSave,
}: {
  book?: Book;
  openLibraryEnabled: boolean;
  onClose: () => void;
  onSave: (input: BookInput) => Promise<void>;
}) {
  const [value, setValue] = useState(() => initialValue(book));
  const [tagsText, setTagsText] = useState(() => book?.tags.join(", ") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OpenLibraryBook[]>([]);
  const title = book ? "Edit book" : "Add book";
  const prepared = useMemo(
    () => ({
      ...value,
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      coverColor: book?.coverColor ?? bookCoverColor(value.title),
    }),
    [book?.coverColor, tagsText, value]
  );

  function patch<K extends keyof BookInput>(key: K, next: BookInput[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function searchOpenLibrary() {
    const query = `${value.title} ${value.author}`.trim();
    if (!openLibraryEnabled || query.length < 2 || searching) return;
    setSearching(true);
    setError("");
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, {
        headers: await authHeaders(),
      });
      const payload = (await response.json()) as {
        books?: OpenLibraryBook[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Open Library search failed.");
      setSearchResults(payload.books ?? []);
      if (!payload.books?.length) setError("No matching Open Library books found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Open Library search failed.");
    } finally {
      setSearching(false);
    }
  }

  function chooseOpenLibraryBook(result: OpenLibraryBook) {
    setValue((current) => ({
      ...current,
      title: result.title,
      author: result.author,
      isbn: result.isbn,
      openLibraryId: result.openLibraryId,
      coverId: result.coverId,
      pageCount: current.pageCount ?? result.pageCount,
      coverColor: bookCoverColor(result.title),
    }));
    setSearchResults([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = validateBook(prepared);
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(prepared);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this book.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-otto-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-otto-divider bg-otto-bg/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <b className="text-[15px]">{title}</b>
        <button
          type="submit"
          form="book-editor"
          disabled={busy}
          className="px-1 text-[13px] font-bold text-otto-green disabled:opacity-50"
        >
          Save
        </button>
      </header>

      <form
        id="book-editor"
        onSubmit={submit}
        className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-[18px] py-5 pb-10"
      >
        <Field label="What">
          <input
            value={value.title}
            onChange={(event) => patch("title", event.target.value)}
            placeholder="Book title"
            className={inputClass}
            autoFocus
          />
          <input
            value={value.author}
            onChange={(event) => patch("author", event.target.value)}
            placeholder="Author"
            className={`${inputClass} mt-2`}
          />
          {openLibraryEnabled && (
            <button
              type="button"
              onClick={() => void searchOpenLibrary()}
              disabled={searching || !`${value.title} ${value.author}`.trim()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-2 text-[11.5px] font-semibold normal-case tracking-normal text-otto-text-dim disabled:opacity-40"
            >
              <Search size={14} />
              {searching ? "Searching…" : value.coverId ? "Change cover" : "Find book & cover"}
            </button>
          )}
        </Field>

        {openLibraryEnabled && searchResults.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-otto-text-faint">
              Choose the matching book
            </p>
            <div className="space-y-2">
              {searchResults.map((result) => (
                <button
                  key={`${result.openLibraryId}-${result.isbn}-${result.title}`}
                  type="button"
                  onClick={() => chooseOpenLibraryBook(result)}
                  className="flex w-full items-center gap-3 rounded-xl bg-otto-surface px-3 py-3 text-left"
                >
                  <BookCover
                    title={result.title}
                    color={bookCoverColor(result.title)}
                    coverId={result.coverId}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px]">{result.title}</b>
                    <span className="block truncate text-[11.5px] text-otto-text-dim">
                      {result.author}
                      {result.firstPublishYear ? ` · ${result.firstPublishYear}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <Field label="Shelf">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["reading", "Reading"],
                ["read", "Read"],
                ["want_to_read", "Want to read"],
              ] as [BookStatus, string][]
            ).map(([status, label]) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  patch("status", status);
                  if (status === "read") patch("progressPercent", 100);
                }}
                className={`rounded-full px-4 py-2 text-[12px] font-bold ${
                  value.status === status
                    ? "bg-otto-text text-otto-bg"
                    : "bg-otto-surface text-otto-text-dim"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        {value.status === "reading" && (
          <Field label={`Progress · ${value.progressPercent}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={value.progressPercent}
              onChange={(event) => patch("progressPercent", Number(event.target.value))}
              className="w-full"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rating">
            <select
              value={value.rating}
              onChange={(event) => patch("rating", Number(event.target.value))}
              className={inputClass}
            >
              {Array.from({ length: 11 }, (_, index) => index / 2).map((rating) => (
                <option key={rating} value={rating}>
                  {rating ? `${rating} / 5` : "Not rated"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select
              value={value.format}
              onChange={(event) => patch("format", event.target.value as BookFormat)}
              className={inputClass}
            >
              <option value="print">Print</option>
              <option value="ebook">Ebook</option>
              <option value="audiobook">Audiobook</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Pages">
            <input
              type="number"
              min={1}
              value={value.pageCount ?? ""}
              onChange={(event) =>
                patch("pageCount", event.target.value ? Number(event.target.value) : null)
              }
              className={inputClass}
            />
          </Field>
          <Field label="Audio minutes">
            <input
              type="number"
              min={1}
              value={value.durationMinutes ?? ""}
              onChange={(event) =>
                patch("durationMinutes", event.target.value ? Number(event.target.value) : null)
              }
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Started">
            <input
              type="date"
              value={value.startedAt ?? ""}
              onChange={(event) => patch("startedAt", event.target.value || null)}
              className={inputClass}
            />
          </Field>
          <Field label="Finished">
            <input
              type="date"
              value={value.finishedAt ?? ""}
              onChange={(event) => patch("finishedAt", event.target.value || null)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Tags">
          <input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="sci-fi, political, series"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <Field label="Series">
            <input
              value={value.seriesTitle}
              onChange={(event) => patch("seriesTitle", event.target.value)}
              placeholder="Series name"
              className={inputClass}
            />
          </Field>
          <Field label="Book #">
            <input
              type="number"
              min={0}
              step={0.5}
              value={value.seriesIndex ?? ""}
              onChange={(event) =>
                patch("seriesIndex", event.target.value ? Number(event.target.value) : null)
              }
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={value.notes}
            onChange={(event) => patch("notes", event.target.value)}
            placeholder="What stood out?"
            rows={4}
            className="w-full rounded-xl bg-otto-surface px-3 py-3 text-[14px]"
          />
        </Field>

        <Field label="Would recommend">
          <div className="flex gap-2">
            {[
              [true, "Yes"],
              [false, "No"],
            ].map(([answer, label]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => patch("wouldRecommend", answer as boolean)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold ${
                  value.wouldRecommend === answer
                    ? "bg-otto-text text-otto-bg"
                    : "bg-otto-surface text-otto-text-dim"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="text-[12px] font-semibold text-otto-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-xl bg-otto-green py-3 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : book ? "Save changes" : "Add book"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-otto-text-faint">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
