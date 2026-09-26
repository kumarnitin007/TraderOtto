"use client";

import { useState } from "react";
import { Copy, ExternalLink, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { BookCover, StarRating } from "@/components/books/BookCover";
import {
  openLibraryCoverUrl,
  openLibrarySearchUrl,
  openLibraryWorkUrl,
} from "@/lib/openLibrary";
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
  shelfLabel,
  externalCovers,
  onClose,
  onEdit,
  onDelete,
  onRate,
  onFindCover,
}: {
  book: Book;
  shelfLabel: string;
  externalCovers: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onRate: (rating: number) => void;
  onFindCover: () => Promise<string>;
}) {
  const [showCover, setShowCover] = useState(false);
  const [copied, setCopied] = useState("");
  const [coverStatus, setCoverStatus] = useState("");
  const [finding, setFinding] = useState(false);

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
          <button
            type="button"
            onClick={() => setShowCover((current) => !current)}
            aria-label="Show cover links"
            title="Show cover links"
          >
            <BookCover
              title={book.title}
              color={book.coverColor}
              coverId={book.coverId}
              externalCovers={externalCovers}
              size="lg"
            />
          </button>
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold leading-tight">{book.title}</h1>
            <p className="mt-1 text-[13.5px] text-otto-text-dim">{book.author}</p>
            <div className="mt-1">
              <StarRating value={book.rating} onChange={onRate} />
            </div>
          </div>
        </div>

        {showCover && (
          <section className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
            <LinkRow
              label="Cover image"
              url={openLibraryCoverUrl(book.coverId, "L")}
              empty="No cover id stored for this book"
              copied={copied}
              onCopy={setCopied}
            />
            <Divider />
            <LinkRow
              label="Open Library record"
              url={openLibraryWorkUrl(book.openLibraryId)}
              empty="No Open Library id stored"
              copied={copied}
              onCopy={setCopied}
            />
            <Divider />
            <LinkRow
              label="Search Open Library"
              url={openLibrarySearchUrl(book.title, book.author)}
              copied={copied}
              onCopy={setCopied}
            />
            {!externalCovers && (
              <p className="px-4 pb-3 text-[11.5px] text-otto-amber">
                Open Library covers are turned off in Books settings, so no image is requested.
              </p>
            )}
            <div className="px-4 pb-4">
              <button
                type="button"
                disabled={finding}
                onClick={async () => {
                  setFinding(true);
                  setCoverStatus("");
                  setCoverStatus(await onFindCover());
                  setFinding(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-otto-bg px-3.5 py-2 text-[12px] font-bold text-otto-text-dim disabled:opacity-50"
              >
                <RefreshCw size={13} className={finding ? "animate-spin" : ""} />
                {finding ? "Looking…" : "Find cover on Open Library"}
              </button>
              {coverStatus && (
                <p className="mt-2 text-[11.5px] text-otto-text-dim">{coverStatus}</p>
              )}
            </div>
          </section>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl bg-otto-surface">
          <DetailRow
            label="Status"
            value={
              book.status === "read"
                ? `${shelfLabel}${book.finishedAt ? ` · ${dateLabel(book.finishedAt)}` : ""}`
                : book.status === "reading"
                  ? `${shelfLabel} · ${book.progressPercent}%`
                  : shelfLabel
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

        {book.journal.description && (
          <section className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Description
            </p>
            <p className="rounded-2xl bg-otto-surface px-4 py-4 text-[13px] leading-relaxed text-otto-text-dim">
              {book.journal.description}
            </p>
          </section>
        )}

        {book.notes && (
          <section className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
              Review
            </p>
            <p className="rounded-2xl bg-otto-surface px-4 py-4 text-[13px] leading-relaxed text-otto-text-dim">
              {book.notes}
            </p>
          </section>
        )}

        {(book.journal.favoriteCharacter ||
          book.journal.sceneSummary ||
          book.journal.memorableMoments ||
          book.journal.leastFavoritePart) && (
          <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
            {book.journal.favoriteCharacter && (
              <DetailRow label="Favorite character" value={book.journal.favoriteCharacter} />
            )}
            {book.journal.sceneSummary && (
              <>
                <Divider />
                <DetailRow label="Scene" value={book.journal.sceneSummary} />
              </>
            )}
            {book.journal.memorableMoments && (
              <>
                <Divider />
                <DetailRow label="Memorable moments" value={book.journal.memorableMoments} />
              </>
            )}
            {book.journal.leastFavoritePart && (
              <>
                <Divider />
                <DetailRow label="Least favorite part" value={book.journal.leastFavoritePart} />
              </>
            )}
          </div>
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

/** Cover problems are usually a wrong or missing link, so show the exact URL. */
function LinkRow({
  label,
  url,
  empty,
  copied,
  onCopy,
}: {
  label: string;
  url: string | null;
  empty?: string;
  copied: string;
  onCopy: (url: string) => void;
}) {
  return (
    <div className="px-4 py-3">
      <b className="block text-[12px]">{label}</b>
      {url ? (
        <>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-otto-text-dim">
            {url}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                onCopy(url);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-1.5 text-[11.5px] font-semibold text-otto-text-dim"
            >
              <Copy size={12} />
              {copied === url ? "Copied" : "Copy"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-otto-divider px-3 py-1.5 text-[11.5px] font-semibold text-otto-text-dim"
            >
              <ExternalLink size={12} />
              Open
            </a>
          </div>
        </>
      ) : (
        <p className="mt-1 text-[12px] text-otto-text-faint">{empty}</p>
      )}
    </div>
  );
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
