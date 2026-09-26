"use client";

import { Maximize2, MessageSquareText, Pencil, Star, Trash2, X } from "lucide-react";
import { BookCover, StarRating } from "@/components/books/BookCover";
import { SheetAction } from "@/components/ui/ActionSheet";
import type { Book, BookShelf } from "@/types/book";

export function BookSheet({
  book,
  shelves,
  externalCovers,
  onClose,
  onView,
  onEdit,
  onReview,
  onDelete,
  onRate,
  onMove,
  onFavorite,
}: {
  book: Book;
  shelves: BookShelf[];
  externalCovers: boolean;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
  onReview: () => void;
  onDelete: () => void;
  onRate: (rating: number) => void;
  onMove: (status: string) => void;
  onFavorite: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-0 desk:items-center desk:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[720px] flex-col rounded-t-[28px] bg-otto-bg shadow-2xl desk:rounded-[24px]">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-otto-divider desk:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface text-otto-text-dim"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-3 px-4 pb-2 pt-4">
          <BookCover
            title={book.title}
            color={book.coverColor}
            coverId={externalCovers ? book.coverId : null}
            size="md"
          />
          <div className="min-w-0 pr-8">
            <h2 className="truncate text-xl font-extrabold">{book.title}</h2>
            <span className="block truncate text-[13px] text-otto-text-dim">{book.author}</span>
            <div className="mt-1">
              <StarRating value={book.rating} onChange={onRate} />
            </div>
          </div>
        </div>
        <div className="overflow-y-auto px-4 pb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
            Move to
          </p>
          <div className="-mx-4 mb-3 overflow-x-auto px-4 pb-1">
            <div className="flex w-max gap-2">
              {shelves.map((shelf) => (
                <button
                  key={shelf.slug}
                  type="button"
                  onClick={() => onMove(shelf.slug)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-bold ${
                    book.status === shelf.slug
                      ? "bg-otto-text text-otto-bg"
                      : "bg-otto-surface text-otto-text-dim"
                  }`}
                >
                  {shelf.name}
                </button>
              ))}
            </div>
          </div>
          <SheetAction
            icon={Star}
            label={book.favorite ? "Remove from Favorites" : "Add to Favorites"}
            onClick={onFavorite}
            filled={book.favorite}
          />
          <SheetAction icon={Maximize2} label="View details" onClick={onView} />
          <SheetAction
            icon={MessageSquareText}
            label={book.notes.trim() ? "Edit review" : "Write a review"}
            onClick={onReview}
          />
          <SheetAction icon={Pencil} label="Edit book details" onClick={onEdit} />
          <SheetAction
            icon={Trash2}
            label="Delete"
            tone="danger"
            onClick={() => {
              if (window.confirm(`Delete "${book.title}"?`)) onDelete();
            }}
          />
        </div>
      </div>
    </div>
  );
}

