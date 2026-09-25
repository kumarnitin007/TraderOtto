"use client";

import { Check, Plus, RefreshCw, Sparkles } from "lucide-react";
import { BookCover } from "@/components/books/BookCover";
import { bookCoverColor } from "@/lib/books";
import type { BookRecommendation, StoredBookDiscoveryReport } from "@/types/book";

export function DiscoverScreen({
  report,
  generating,
  error,
  canGenerate,
  onGenerate,
  existingKeys,
  addingKey,
  onAddToWishlist,
}: {
  report: StoredBookDiscoveryReport | null;
  generating: boolean;
  error: string;
  canGenerate: boolean;
  onGenerate: () => void;
  existingKeys: Set<string>;
  addingKey: string | null;
  onAddToWishlist: (book: BookRecommendation) => Promise<void>;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
            Personalized picks
          </p>
          <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Discover</h1>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-otto-surface text-otto-green disabled:opacity-40"
          aria-label={report ? "Refresh recommendations" : "Generate recommendations"}
        >
          <RefreshCw size={18} className={generating ? "animate-spin" : ""} />
        </button>
      </div>

      {!report && (
        <div className="mt-5 rounded-2xl bg-otto-surface px-5 py-8 text-center">
          <Sparkles className="mx-auto text-otto-green" />
          <h2 className="mt-3 text-[17px] font-extrabold">Recommendations from your library</h2>
          <p className="mx-auto mt-2 max-w-[460px] text-[12.5px] leading-relaxed text-otto-text-dim">
            Otto uses your titles, ratings, tags, series, and notes to suggest real books that fit
            your taste.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || generating}
            className="mt-5 rounded-xl bg-otto-green px-5 py-3 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {generating ? "Finding books…" : "Find books for me"}
          </button>
          {!canGenerate && (
            <p className="mt-3 text-[11.5px] text-otto-text-faint">
              Add and rate at least one book first.
            </p>
          )}
        </div>
      )}

      {report && (
        <>
          <p className="mt-5 rounded-2xl bg-otto-surface px-4 py-4 text-[13px] leading-relaxed text-otto-text-dim">
            {report.profile}
          </p>
          <div className="mt-4 space-y-2.5">
            {report.recommendations.map((book) => {
              const key = `${book.title.trim().toLowerCase()}\u001f${book.author.trim().toLowerCase()}`;
              return (
                <RecommendationCard
                  key={`${book.title}-${book.author}`}
                  book={book}
                  inLibrary={existingKeys.has(key)}
                  adding={addingKey === key}
                  onAdd={() => onAddToWishlist(book)}
                />
              );
            })}
          </div>
          {report.notForYou.length > 0 && (
            <>
              <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
                Not for you
              </p>
              <div className="space-y-2.5 opacity-75">
                {report.notForYou.map((book) => (
                  <RecommendationCard key={`${book.title}-${book.author}`} book={book} />
                ))}
              </div>
            </>
          )}
          <p className="mt-4 text-center text-[10.5px] text-otto-text-faint">
            AI-generated · verify book details before adding
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-otto-red-soft px-4 py-3 text-[12px] text-otto-red">
          {error}
        </p>
      )}
    </section>
  );
}

function RecommendationCard({
  book,
  inLibrary = false,
  adding = false,
  onAdd,
}: {
  book: BookRecommendation;
  inLibrary?: boolean;
  adding?: boolean;
  onAdd?: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-otto-surface px-3.5 py-3">
      <BookCover title={book.title} color={bookCoverColor(book.title)} size="sm" />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[15px]">{book.title}</b>
        <span className="block truncate text-[12px] text-otto-text-dim">{book.author}</span>
        <p className="mt-1 text-[11.5px] font-semibold leading-snug text-otto-green">
          {book.reason}
        </p>
      </div>
      {onAdd && (
        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={inLibrary || adding}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            inLibrary
              ? "bg-otto-green-soft text-otto-green"
              : "border border-otto-divider text-otto-text-dim"
          } disabled:opacity-70`}
          aria-label={inLibrary ? `${book.title} is in your library` : `Add ${book.title} to Want to read`}
          title={inLibrary ? "In your library" : "Add to Want to read"}
        >
          {inLibrary ? <Check size={17} /> : <Plus size={17} />}
        </button>
      )}
    </div>
  );
}
