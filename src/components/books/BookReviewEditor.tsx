"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { BookCover, StarRating } from "@/components/books/BookCover";
import type { Book, BookInput } from "@/types/book";

/** A single-purpose screen for writing a review, without the full edit form. */
export function BookReviewEditor({
  book,
  externalCovers,
  onClose,
  onSave,
}: {
  book: Book;
  externalCovers: boolean;
  onClose: () => void;
  onSave: (patch: Partial<BookInput>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(book.notes);
  const [rating, setRating] = useState(book.rating);
  const [favorite, setFavorite] = useState(book.favorite);
  const [wouldRecommend, setWouldRecommend] = useState(book.wouldRecommend);
  const [journal, setJournal] = useState(book.journal);
  const [showMore, setShowMore] = useState(
    Boolean(
      book.journal.favoriteCharacter ||
        book.journal.memorableMoments ||
        book.journal.leastFavoritePart
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ notes, rating, favorite, wouldRecommend, journal });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this review.");
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
        <b className="text-[15px]">Review</b>
        <button
          type="submit"
          form="book-review"
          disabled={busy}
          className="px-1 text-[13px] font-bold text-otto-green disabled:opacity-50"
        >
          Save
        </button>
      </header>

      <form
        id="book-review"
        onSubmit={submit}
        className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-[18px] py-5 pb-12"
      >
        <div className="flex items-center gap-4">
          <BookCover
            title={book.title}
            color={book.coverColor}
            coverId={book.coverId}
            externalCovers={externalCovers}
            size="md"
          />
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-extrabold leading-tight">{book.title}</h1>
            <p className="truncate text-[13px] text-otto-text-dim">{book.author}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-otto-surface px-4 py-3">
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <button
              type="button"
              onClick={() => setRating(0)}
              className="text-[11px] font-semibold text-otto-text-faint"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setFavorite((current) => !current)}
            className={`ml-auto text-[12px] font-bold ${
              favorite ? "text-otto-amber" : "text-otto-text-faint"
            }`}
          >
            {favorite ? "★ Favorite" : "☆ Favorite"}
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-otto-text-faint">
            Your review
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What did you like or dislike? What stood out?"
            rows={12}
            autoFocus
            className="w-full rounded-xl bg-otto-surface px-3.5 py-3 text-[15px] leading-relaxed"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-otto-text-faint">
            Would recommend
          </span>
          <div className="flex gap-2">
            {[
              [true, "Yes"],
              [false, "No"],
            ].map(([answer, label]) => (
              <button
                key={label as string}
                type="button"
                onClick={() =>
                  setWouldRecommend((current) =>
                    current === answer ? null : (answer as boolean)
                  )
                }
                className={`rounded-full px-4 py-2 text-[12px] font-bold ${
                  wouldRecommend === answer
                    ? "bg-otto-text text-otto-bg"
                    : "bg-otto-surface text-otto-text-dim"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {showMore ? (
          <div className="flex flex-col gap-4">
            <JournalField
              label="Favorite character"
              value={journal.favoriteCharacter}
              onChange={(favoriteCharacter) =>
                setJournal((current) => ({ ...current, favoriteCharacter }))
              }
            />
            <JournalField
              label="Memorable moments"
              value={journal.memorableMoments}
              rows={3}
              onChange={(memorableMoments) =>
                setJournal((current) => ({ ...current, memorableMoments }))
              }
            />
            <JournalField
              label="Least favorite part"
              value={journal.leastFavoritePart}
              rows={3}
              onChange={(leastFavoritePart) =>
                setJournal((current) => ({ ...current, leastFavoritePart }))
              }
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="self-start text-[12.5px] font-bold text-otto-text-dim"
          >
            Add characters and moments
          </button>
        )}

        {error && <p className="text-[12px] font-semibold text-otto-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-otto-green py-3 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save review"}
        </button>
      </form>
    </div>
  );
}

function JournalField({
  label,
  value,
  rows = 1,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.07em] text-otto-text-faint">
        {label}
      </span>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className="w-full rounded-xl bg-otto-surface px-3.5 py-3 text-[14px]"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-[10px] border border-otto-divider bg-otto-surface px-3 py-2.5 text-[14px]"
        />
      )}
    </label>
  );
}
