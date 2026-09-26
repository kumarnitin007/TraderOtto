"use client";

import { Plus, Star } from "lucide-react";
import { BookCover, StarRating } from "@/components/books/BookCover";
import { FAVORITES_FILTER, filterBooks } from "@/lib/books";
import type { Book, BookShelf } from "@/types/book";

export function BookshelfScreen({
  books,
  shelves,
  filter,
  onFilter,
  onSelect,
  onAdd,
  loading,
  externalCovers,
}: {
  books: Book[];
  shelves: BookShelf[];
  filter: string;
  onFilter: (filter: string) => void;
  onSelect: (book: Book) => void;
  onAdd: () => void;
  loading: boolean;
  externalCovers: boolean;
}) {
  const filtered = filterBooks(books, filter);
  const recent = filter === "reading" ? filterBooks(books, "read").slice(0, 4) : [];

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Bookshelf</h1>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Add book"
        >
          <Plus size={19} />
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onFilter(FAVORITES_FILTER)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold ${
            filter === FAVORITES_FILTER
              ? "bg-otto-text text-otto-bg"
              : "bg-otto-surface text-otto-text-dim"
          }`}
        >
          <Star size={13} className={filter === FAVORITES_FILTER ? "fill-current" : ""} />
          Favorites
        </button>
        {shelves.map((item) => (
          <button
            key={item.slug}
            type="button"
            onClick={() => onFilter(item.slug)}
            className={`shrink-0 rounded-full px-4 py-2 text-[12.5px] font-bold ${
              filter === item.slug
                ? "bg-otto-text text-otto-bg"
                : "bg-otto-surface text-otto-text-dim"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5">
        {filtered.map((book) => (
          <BookRow
            key={book.id}
            book={book}
            onClick={() => onSelect(book)}
            externalCovers={externalCovers}
          />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="mt-4 rounded-2xl bg-otto-surface px-5 py-10 text-center">
          <BookCover title="Book" color="#4d8069" size="sm" />
          <h2 className="mt-3 font-extrabold">No books here yet</h2>
          <p className="mt-1 text-[13px] text-otto-text-dim">
            {filter === FAVORITES_FILTER
              ? "Star a book from its menu to keep it in Favorites."
              : "Add a title and choose this shelf to get started."}
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 rounded-full bg-otto-green px-4 py-2 text-[12px] font-bold text-white"
          >
            Add a book
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
            Finished recently
          </p>
          <div className="space-y-2.5">
            {recent.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                onClick={() => onSelect(book)}
                compact
                externalCovers={externalCovers}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BookRow({
  book,
  onClick,
  compact = false,
  externalCovers,
}: {
  book: Book;
  onClick: () => void;
  compact?: boolean;
  externalCovers: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-otto-surface px-3.5 py-3 text-left"
    >
      <BookCover
        title={book.title}
        color={book.coverColor}
        coverId={book.coverId}
        externalCovers={externalCovers}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-1 truncate text-[15px]">
          <span className="truncate">{book.title}</span>
          {book.favorite && <Star size={13} className="shrink-0 fill-otto-amber text-otto-amber" />}
        </b>
        <span className="block truncate text-[12.5px] text-otto-text-dim">{book.author}</span>
        {compact || book.status === "read" ? (
          <StarRating value={book.rating} />
        ) : (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-otto-divider">
            <span
              className="block h-full rounded-full bg-otto-green"
              style={{ width: `${book.progressPercent}%` }}
            />
          </span>
        )}
      </span>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          book.status === "read"
            ? "bg-otto-green-soft text-otto-green"
            : "bg-otto-amber-soft text-otto-amber"
        }`}
      >
        {book.status === "read" ? "Read" : `${book.progressPercent}%`}
      </span>
    </button>
  );
}
