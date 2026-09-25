"use client";

import { useState } from "react";
import { BookCheck } from "lucide-react";
import { BookDetail } from "@/components/books/BookDetail";
import { BookEditor } from "@/components/books/BookEditor";
import { BooksBottomNav, type BooksTab } from "@/components/books/BooksBottomNav";
import { BooksSettingsScreen } from "@/components/books/BooksSettingsScreen";
import { BooksStatsScreen } from "@/components/books/BooksStatsScreen";
import { BookshelfScreen } from "@/components/books/BookshelfScreen";
import { DiscoverScreen } from "@/components/books/DiscoverScreen";
import { useBooks } from "@/hooks/useBooks";
import { useScreenOption } from "@/hooks/useScreenOption";
import { authHeaders } from "@/lib/authHeaders";
import { bookCoverColor, bookIdentityKey } from "@/lib/books";
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
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [addingRecommendation, setAddingRecommendation] = useState<string | null>(null);

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
    setTab("library");
    setToast(book ? "Book updated" : "Book added");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function remove(book: Book) {
    try {
      await booksState.deleteBook(book.id);
      setSelected(null);
      setToast("Book deleted");
      window.setTimeout(() => setToast(""), 1800);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not delete this book.");
    }
  }

  async function generateRecommendations() {
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
        body: JSON.stringify({ books: booksState.books }),
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
        tags: recommendation.tags,
        seriesTitle: "",
        seriesIndex: null,
        isbn: match?.isbn ?? "",
        openLibraryId: match?.openLibraryId ?? "",
        coverId: match?.coverId ?? null,
        coverColor: bookCoverColor(recommendation.title),
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
          filter={filter}
          onFilter={setFilter}
          onSelect={setSelected}
          onAdd={() => chooseTab("add")}
          loading={booksState.loading}
          externalCovers={openLibraryEnabled}
        />
      )}
      {visibleTab === "discover" && (
        <DiscoverScreen
          report={booksState.discovery}
          generating={generating}
          error={actionError}
          canGenerate={!booksState.readonly && booksState.books.length > 0}
          onGenerate={() => void generateRecommendations()}
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
          openLibraryEnabled={openLibraryEnabled}
          onOpenLibraryChange={setOpenLibraryEnabled}
        />
      )}

      <BooksBottomNav tab={tab} onTab={chooseTab} />

      {selected && (
        <BookDetail
          book={selected}
          externalCovers={openLibraryEnabled}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onDelete={() => remove(selected)}
        />
      )}
      {editing && (
        <BookEditor
          book={editing === "new" ? undefined : editing}
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
