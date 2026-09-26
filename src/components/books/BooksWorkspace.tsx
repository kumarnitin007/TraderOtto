"use client";

import { useEffect, useState } from "react";
import { BookCheck } from "lucide-react";
import { BookDetail } from "@/components/books/BookDetail";
import { BookEditor } from "@/components/books/BookEditor";
import { BookSheet } from "@/components/books/BookSheet";
import { BooksBottomNav, type BooksTab } from "@/components/books/BooksBottomNav";
import { BooksSettingsScreen } from "@/components/books/BooksSettingsScreen";
import { BooksStatsScreen } from "@/components/books/BooksStatsScreen";
import { BookshelfScreen } from "@/components/books/BookshelfScreen";
import { DiscoverScreen } from "@/components/books/DiscoverScreen";
import { useBooks } from "@/hooks/useBooks";
import { useScreenOption } from "@/hooks/useScreenOption";
import { authHeaders } from "@/lib/authHeaders";
import { bookCoverColor, bookIdentityKey } from "@/lib/books";
import {
  bookInputFromImport,
  bookshelfExportCsv,
  bookshelfExportJson,
  parseBookshelfFile,
  shelfNamesToCreate,
} from "@/lib/booksTransfer";
import {
  DEFAULT_BOOKS_PREFERENCES,
  readBooksPreferences,
  writeBooksPreferences,
  type BooksPreferences,
  type RecommendationRequest,
} from "@/lib/booksPreferences";
import { EMPTY_BOOK_JOURNAL } from "@/types/book";
import type {
  Book,
  BookDiscoveryReport,
  BookInput,
  BookRecommendation,
  OpenLibraryBook,
} from "@/types/book";

export function BooksWorkspace() {
  const booksState = useBooks();
  const [tab, setTab] = useScreenOption("booksTab");
  const [filter, setFilter] = useScreenOption("booksFilter");
  const [openLibraryEnabled, setOpenLibraryEnabled] = useScreenOption(
    "booksOpenLibraryEnabled"
  );
  const [selected, setSelected] = useState<Book | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [addingRecommendation, setAddingRecommendation] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<BooksPreferences>(
    DEFAULT_BOOKS_PREFERENCES
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    setPreferences(readBooksPreferences());
    setPreferencesLoaded(true);
  }, []);

  function changePreferences(next: BooksPreferences) {
    setPreferences(next);
    writeBooksPreferences(next);
  }

  function chooseTab(next: BooksTab) {
    if (next === "add") {
      setTab("add");
      setEditing("new");
      return;
    }
    setTab(next);
  }

  async function save(input: BookInput, book?: Book) {
    const saved = await booksState.saveBook(input, book?.id);
    setEditing(null);
    setSelected(saved);
    setDetailOpen(false);
    setTab("library");
    setToast(book ? "Book updated" : "Book added");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function remove(book: Book) {
    try {
      await booksState.deleteBook(book.id);
      setSelected(null);
      setDetailOpen(false);
      setToast("Book deleted");
      window.setTimeout(() => setToast(""), 1800);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not delete this book.");
    }
  }

  function toInput(book: Book, patch: Partial<BookInput> = {}): BookInput {
    const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...input } =
      book;
    return { ...input, ...patch };
  }

  async function updateBook(book: Book, patch: Partial<BookInput>) {
    try {
      const saved = await booksState.saveBook(
        toInput(book, {
          ...patch,
          progressPercent:
            patch.status === "read" ? 100 : patch.progressPercent ?? book.progressPercent,
        }),
        book.id
      );
      setSelected(saved);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not update this book.");
    }
  }

  function exportLibrary(format: "json" | "csv") {
    const text =
      format === "csv"
        ? bookshelfExportCsv(booksState.books, booksState.shelves)
        : bookshelfExportJson(booksState.books, booksState.shelves);
    const blob = new Blob([text], {
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const day = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `bookshelf-export-${day}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importLibrary(file: File) {
    const entries = parseBookshelfFile(await file.text());
    if (!entries.length) throw new Error("No books found in that file.");
    let shelves = booksState.shelves;
    for (const name of shelfNamesToCreate(entries, shelves)) {
      shelves = [...shelves, await booksState.addShelf(name)];
    }
    let added = 0;
    let updated = 0;
    for (const entry of entries) {
      const input = bookInputFromImport(entry, shelves);
      const existing = booksState.books.find(
        (book) =>
          bookIdentityKey(book.title, book.author) === bookIdentityKey(entry.title, entry.author)
      );
      if (existing) {
        await booksState.saveBook(
          {
            ...input,
            isbn: existing.isbn,
            openLibraryId: existing.openLibraryId,
            format: existing.format,
            pageCount: existing.pageCount,
            durationMinutes: existing.durationMinutes,
            seriesTitle: existing.seriesTitle,
            seriesIndex: existing.seriesIndex,
            wouldRecommend: existing.wouldRecommend,
            coverId: input.coverId ?? existing.coverId,
            coverColor: existing.coverColor,
            favorite: entry.favoriteSpecified ? entry.favorite : existing.favorite,
            progressPercent: entry.finishedAt ? 100 : existing.progressPercent,
          },
          existing.id
        );
        updated += 1;
      } else {
        await booksState.saveBook(input);
        added += 1;
      }
    }
    setToast(`Imported ${added} new, updated ${updated}`);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function generateRecommendations(
    includeIds: string[],
    request: RecommendationRequest
  ) {
    if (!booksState.books.length || generating) return;
    setGenerating(true);
    setActionError("");
    try {
      const response = await fetch("/api/books/discover", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          includeIds,
          request,
          preferences: {
            audience: preferences.audience,
            likedGenres: preferences.likedGenres,
            avoid: preferences.avoid,
            readerNotes: preferences.readerNotes,
          },
        }),
      });
      const payload = (await response.json()) as {
        report?: BookDiscoveryReport;
        model?: string;
        error?: string;
      };
      if (!response.ok || !payload.report) {
        throw new Error(payload.error ?? "Could not generate recommendations.");
      }
      await booksState.saveDiscovery(payload.report, payload.model ?? "unknown");
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Could not generate recommendations."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function addRecommendationToWishlist(recommendation: BookRecommendation) {
    const key = bookIdentityKey(recommendation.title, recommendation.author);
    if (
      addingRecommendation ||
      booksState.books.some(
        (book) => bookIdentityKey(book.title, book.author) === key
      )
    ) {
      return;
    }
    setAddingRecommendation(key);
    setActionError("");
    let match: OpenLibraryBook | null = null;
    if (openLibraryEnabled) {
      try {
        const response = await fetch(
          `/api/books/search?q=${encodeURIComponent(`${recommendation.title} ${recommendation.author}`)}`,
          { headers: await authHeaders() }
        );
        const payload = (await response.json()) as { books?: OpenLibraryBook[] };
        if (response.ok) match = payload.books?.[0] ?? null;
      } catch {
        // A cover lookup failure must not prevent adding the recommendation.
      }
    }
    try {
      await booksState.saveBook({
        title: match?.title ?? recommendation.title,
        author: match?.author ?? recommendation.author,
        status: "want_to_read",
        progressPercent: 0,
        rating: 0,
        wouldRecommend: null,
        format: "print",
        pageCount: match?.pageCount ?? null,
        durationMinutes: null,
        startedAt: null,
        finishedAt: null,
        notes: "",
        tags: match?.subjects.length ? match.subjects : recommendation.tags,
        seriesTitle: "",
        seriesIndex: null,
        isbn: match?.isbn ?? "",
        openLibraryId: match?.openLibraryId ?? "",
        coverId: match?.coverId ?? null,
        coverColor: bookCoverColor(recommendation.title),
        favorite: false,
        journal: { ...EMPTY_BOOK_JOURNAL, bookshelfType: "wishlist" },
      });
      setToast("Added to Want to read");
      window.setTimeout(() => setToast(""), 1800);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not add this book.");
    } finally {
      setAddingRecommendation(null);
    }
  }

  const visibleTab = tab === "add" ? "library" : tab;

  return (
    <div className="mx-auto max-w-[720px] pb-28">
      {(booksState.error || actionError) && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-otto-red/30 bg-otto-red-soft px-3.5 py-3 text-[13px] text-otto-red"
        >
          {actionError || booksState.error}
        </div>
      )}
      {booksState.readonly && (
        <div className="mb-4 rounded-xl border border-otto-amber/30 bg-otto-amber-soft px-3.5 py-3 text-[12.5px] text-otto-amber">
          Sign in to save a private Books library.
        </div>
      )}

      {visibleTab === "library" && (
        <BookshelfScreen
          books={booksState.books}
          shelves={booksState.shelves}
          filter={filter}
          onFilter={setFilter}
          onSelect={(book) => {
            setSelected(book);
            setDetailOpen(false);
          }}
          onAdd={() => chooseTab("add")}
          loading={booksState.loading}
          externalCovers={openLibraryEnabled}
        />
      )}
      {visibleTab === "discover" && (
        <DiscoverScreen
          books={booksState.books}
          preferences={preferences}
          report={booksState.discovery}
          generating={generating}
          error={actionError}
          canGenerate={
            preferencesLoaded && !booksState.readonly && booksState.books.length > 0
          }
          onGenerate={(includeIds, request) =>
            void generateRecommendations(includeIds, request)
          }
          existingKeys={
            new Set(
              booksState.books.map((book) => bookIdentityKey(book.title, book.author))
            )
          }
          addingKey={addingRecommendation}
          onAddToWishlist={addRecommendationToWishlist}
        />
      )}
      {visibleTab === "stats" && <BooksStatsScreen books={booksState.books} />}
      {visibleTab === "settings" && (
        <BooksSettingsScreen
          books={booksState.books}
          shelves={booksState.shelves}
          preferences={preferences}
          onPreferencesChange={changePreferences}
          openLibraryEnabled={openLibraryEnabled}
          onOpenLibraryChange={setOpenLibraryEnabled}
          onAddShelf={(name) => booksState.addShelf(name).then(() => undefined)}
          onRemoveShelf={async (shelf, destination) => {
            await booksState.removeShelf(shelf, destination);
            if (filter === shelf.slug) setFilter(destination || "reading");
          }}
          onExport={exportLibrary}
          onImport={importLibrary}
        />
      )}

      <BooksBottomNav tab={tab} onTab={chooseTab} />

      {selected && !detailOpen && (
        <BookSheet
          book={selected}
          shelves={booksState.shelves}
          externalCovers={openLibraryEnabled}
          onClose={() => setSelected(null)}
          onView={() => setDetailOpen(true)}
          onEdit={() => setEditing(selected)}
          onDelete={() => void remove(selected)}
          onRate={(rating) => void updateBook(selected, { rating })}
          onMove={(status) => {
            if (status !== selected.status) void updateBook(selected, { status });
          }}
          onFavorite={() => void updateBook(selected, { favorite: !selected.favorite })}
        />
      )}
      {selected && detailOpen && (
        <BookDetail
          book={selected}
          shelfLabel={
            booksState.shelves.find((shelf) => shelf.slug === selected.status)?.name ??
            selected.status
          }
          externalCovers={openLibraryEnabled}
          onClose={() => setDetailOpen(false)}
          onEdit={() => setEditing(selected)}
          onDelete={() => remove(selected)}
          onRate={(rating) => void updateBook(selected, { rating })}
        />
      )}
      {editing && (
        <BookEditor
          book={editing === "new" ? undefined : editing}
          shelves={booksState.shelves}
          openLibraryEnabled={openLibraryEnabled}
          onClose={() => {
            setEditing(null);
            if (tab === "add") setTab("library");
          }}
          onSave={(input) => save(input, editing === "new" ? undefined : editing)}
        />
      )}
      {toast && (
        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-otto-surface px-4 py-2 text-[13px] font-semibold shadow-lg desk:bottom-8">
          <BookCheck size={18} className="text-otto-green" />
          {toast}
        </div>
      )}
    </div>
  );
}
