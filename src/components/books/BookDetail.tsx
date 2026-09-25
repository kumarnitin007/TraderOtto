"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { BookCover, StarRating } from "@/components/books/BookCover";
import type { Book } from "@/types/book";

function dateLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function BookDetail({
  book,
  externalCovers,
  onClose,
  onEdit,
  onDelete,
}: {
  book: Book;
  externalCovers: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
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
        <b className="text-[15px]">Book</b>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Edit book"
        >
          <Pencil size={16} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-[18px] py-7 pb-12">
        <div className="flex items-center gap-5 px-6">
          <BookCover
            title={book.title}
            color={book.coverColor}
            coverId={book.coverId}
            externalCovers={externalCovers}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold leading-tight">{book.title}</h1>
            <p className="mt-1 text-[13.5px] text-otto-text-dim">{book.author}</p>
            <div className="mt-1"><StarRating value={book.rating} /></div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-otto-surface">
          <DetailRow
            label="Status"
            value={
              book.status === "read"
                ? `Read${book.finishedAt ? ` · ${dateLabel(book.finishedAt)}` : ""}`
                : book.status === "reading"
                  ? `Reading · ${book.progressPercent}%`
                  : "Want to read"
            }
          />
          <Divider />
          <DetailRow
            label="Format"
            value={book.format[0].toUpperCase() + book.format.slice(1)}
          />
          {(book.pageCount || book.durationMinutes) && (
            <>
              <Divider />
              <DetailRow
                label="Pages / length"
                value={
                  book.pageCount
                    ? `${book.pageCount} pp`
                    : `${Math.floor((book.durationMinutes ?? 0) / 60)}h ${(book.durationMinutes ?? 0) % 60}m`
                }
              />
            </>
          )}
        </div>

        {book.tags.length > 0 && (
          <section className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-otto-green-soft px-3 py-1.5 text-[11.5px] font-semibold text-otto-green"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {book.notes && (
          <section className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Notes
            </p>
            <p className="rounded-2xl bg-otto-surface px-4 py-4 text-[13px] leading-relaxed text-otto-text-dim">
              {book.notes}
            </p>
          </section>
        )}

        {book.wouldRecommend != null && (
          <div className="mt-3">
            <DetailRow
              label="Would recommend"
              value={book.wouldRecommend ? "Yes" : "No"}
              standalone
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete “${book.title}” from your library?`)) void onDelete();
          }}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-otto-red-soft py-3 text-[13px] font-bold text-otto-red"
        >
          <Trash2 size={16} />
          Delete book
        </button>
      </main>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 border-t border-otto-divider" />;
}

function DetailRow({
  label,
  value,
  standalone,
}: {
  label: string;
  value: string;
  standalone?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3.5 ${
        standalone ? "rounded-2xl bg-otto-surface" : ""
      }`}
    >
      <b className="text-[13px]">{label}</b>
      <span className="text-right text-[13px] text-otto-text-dim">{value}</span>
    </div>
  );
}
