"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Clipboard, ExternalLink, Plus, RefreshCw, Sparkles } from "lucide-react";
import { BookCover, StarRating } from "@/components/books/BookCover";
import { PromptPreview } from "@/components/ai/PromptPreview";
import { authHeaders } from "@/lib/authHeaders";
import { coverPatchFromSearch } from "@/lib/bookCleanup";
import { bookCoverColor } from "@/lib/books";
import { buildBookDiscoveryPrompt, type BookPromptEntry } from "@/lib/bookDiscoveryPrompt";
import {
  DISCOVERY_BEST_COUNT,
  DISCOVERY_LIMIT,
  DISCOVERY_WORST_COUNT,
  selectDiscoveryBooks,
} from "@/lib/booksDiscovery";
import {
  catalogSearchUrl,
  RECOMMENDATION_CRITERIA,
  type BooksPreferences,
  type RecommendationCriteria,
  type RecommendationRequest,
} from "@/lib/booksPreferences";
import { readingAuthors } from "@/lib/readingAuthors";
import type {
  Book,
  BookRecommendation,
  OpenLibraryBook,
  StoredBookDiscoveryReport,
} from "@/types/book";

export function DiscoverScreen({
  books,
  preferences,
  report,
  generating,
  error,
  canGenerate,
  onGenerate,
  existingKeys,
  addingKey,
  onAddToWishlist,
  lastPrompt,
  externalCovers,
}: {
  books: Book[];
  preferences: BooksPreferences;
  report: StoredBookDiscoveryReport | null;
  generating: boolean;
  error: string;
  canGenerate: boolean;
  onGenerate: (includeIds: string[], request: RecommendationRequest) => void;
  existingKeys: Set<string>;
  addingKey: string | null;
  onAddToWishlist: (book: BookRecommendation) => Promise<void>;
  lastPrompt: string;
  externalCovers: boolean;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [showBooks, setShowBooks] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<RecommendationCriteria>("Best selling");
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [authorDraft, setAuthorDraft] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [recommendationCovers, setRecommendationCovers] = useState<Record<string, number | null>>(
    {}
  );

  const suggestedIds = selectDiscoveryBooks(books).map((book) => book.id);
  const suggestedAuthors = readingAuthors(books);
  const authorChoices = [
    ...suggestedAuthors,
    ...selectedAuthors
      .filter(
        (name) =>
          !suggestedAuthors.some((author) => author.name.toLowerCase() === name.toLowerCase())
      )
      .map((name) => ({ name, books: 0 })),
  ];
  const sendCount = Math.min(selected.length, DISCOVERY_LIMIT);

  useEffect(() => {
    if (!report || !externalCovers) {
      setRecommendationCovers({});
      return;
    }
    let cancelled = false;
    const recommendations = [...report.recommendations, ...report.notForYou];
    const unique = recommendations.filter(
      (book, index) =>
        recommendations.findIndex((item) => recommendationKey(item) === recommendationKey(book)) ===
        index
    );
    void Promise.all(
      unique.map(async (book) => {
        const key = recommendationKey(book);
        try {
          const response = await fetch(
            `/api/books/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`,
            { headers: await authHeaders() }
          );
          if (!response.ok) return [key, null] as const;
          const payload = (await response.json()) as { books?: OpenLibraryBook[] };
          const patch = coverPatchFromSearch(
            {
              title: book.title,
              author: book.author,
              coverId: null,
              isbn: "",
              openLibraryId: "",
              pageCount: null,
              tags: [],
            },
            payload.books ?? []
          );
          return [key, patch?.coverId ?? null] as const;
        } catch {
          return [key, null] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setRecommendationCovers(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [externalCovers, report]);

  function openReview() {
    setSelected(suggestedIds);
    setSelectedAuthors(suggestedAuthors.map((author) => author.name));
    setShowBooks(false);
    setReviewing(true);
  }

  function toggleAuthor(name: string) {
    setSelectedAuthors((current) =>
      current.some((author) => author.toLowerCase() === name.toLowerCase())
        ? current.filter((author) => author.toLowerCase() !== name.toLowerCase())
        : [...current, name]
    );
  }

  function addAuthor() {
    const name = authorDraft.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) return;
    setSelectedAuthors((current) =>
      current.some((author) => author.toLowerCase() === name.toLowerCase())
        ? current
        : [...current, name]
    );
    setAuthorDraft("");
  }

  function promptForRequest() {
    const sample: BookPromptEntry[] = books
      .filter((book) => selected.includes(book.id))
      .slice(0, DISCOVERY_LIMIT)
      .map((book) => ({
        title: book.title,
        author: book.author,
        status: book.status,
        rating: book.rating,
        wouldRecommend: book.wouldRecommend,
        tags: book.tags,
        seriesTitle: book.seriesTitle || null,
        notes: book.notes,
      }));
    return buildBookDiscoveryPrompt(sample, preferences, {
      goal: criteria,
      note: requestNote,
      authors: selectedAuthors,
      criteria,
    });
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(promptForRequest());
    setPromptCopied(true);
  }
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
          onClick={openReview}
          disabled={!canGenerate || generating}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-otto-surface text-otto-green disabled:opacity-40"
          aria-label={report ? "Refresh recommendations" : "Generate recommendations"}
        >
          <RefreshCw size={18} className={generating ? "animate-spin" : ""} />
        </button>
      </div>

      {reviewing && (
        <div className="mt-4">
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className="text-[15px] font-extrabold">Authors you have been reading</h2>
            <span className="shrink-0 text-[11px] text-otto-text-faint">
              {selectedAuthors.length} selected
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {authorChoices.map((author) => {
              const active = selectedAuthors.some(
                (name) => name.toLowerCase() === author.name.toLowerCase()
              );
              return (
                <button
                  key={author.name}
                  type="button"
                  onClick={() => toggleAuthor(author.name)}
                  className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-bold ${
                    active ? "bg-otto-text text-otto-bg" : "bg-otto-surface text-otto-text-faint"
                  }`}
                >
                  {author.name}
                  {author.books > 0 ? ` · ${author.books}` : ""}
                </button>
              );
            })}
            {!authorChoices.length && (
              <span className="py-2 text-[12px] text-otto-text-faint">
                Add an author to start.
              </span>
            )}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addAuthor();
            }}
          >
            <input
              value={authorDraft}
              onChange={(event) => setAuthorDraft(event.target.value)}
              placeholder="Add another author"
              className="min-w-0 flex-1 rounded-full bg-otto-surface px-3.5 py-2.5 text-[13px]"
              aria-label="Add another author"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-otto-surface px-3.5 py-2.5 text-[12px] font-bold"
            >
              Add
            </button>
          </form>

          <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">
            Fetch by
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {RECOMMENDATION_CRITERIA.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCriteria(item)}
                className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-bold ${
                  criteria === item
                    ? "bg-otto-green text-black"
                    : "bg-otto-surface text-otto-text-dim"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onGenerate(selected, {
                  goal: criteria,
                  note: requestNote,
                  authors: selectedAuthors,
                  criteria,
                });
                setReviewing(false);
              }}
              disabled={!selectedAuthors.length || generating}
              className="flex-1 rounded-full bg-otto-green py-3 text-[13px] font-bold text-black disabled:opacity-40"
            >
              {generating ? "Finding books…" : "Fetch"}
            </button>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-otto-divider"
              aria-label={promptCopied ? "Prompt copied" : "Copy prompt"}
              title="Copy the prompt so you can tune it"
            >
              {promptCopied ? <Check size={16} className="text-otto-green" /> : <Clipboard size={16} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBooks((current) => !current)}
            className="mt-3 flex w-full items-center justify-between rounded-xl bg-otto-surface px-3.5 py-3 text-left"
          >
            <span>
              <b className="block text-[13px]">Taste sample and note</b>
              <span className="text-[11.5px] text-otto-text-dim">
                {sendCount} book{sendCount === 1 ? "" : "s"} included
                {preferences.audience ? ` · ${audienceLabel(preferences.audience)}` : ""}
              </span>
            </span>
            <ChevronDown
              size={17}
              className={`transition-transform ${showBooks ? "rotate-180" : ""}`}
            />
          </button>
          {showBooks && (
            <div className="mt-2">
              <textarea
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value.slice(0, 300))}
                placeholder="Optional: e.g. a smart mystery without graphic violence"
                rows={2}
                className="w-full rounded-xl bg-otto-surface px-3.5 py-3 text-[13px]"
              />
              <p className="mt-2 text-[11.5px] leading-relaxed text-otto-text-faint">
                Otto also sends your {DISCOVERY_BEST_COUNT} best and {DISCOVERY_WORST_COUNT} lowest
                rated books so it can avoid repeats and respect dislikes.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(suggestedIds)}
                  className="rounded-full bg-otto-surface px-3.5 py-2 text-[12px] font-bold text-otto-text-dim"
                >
                  Best and worst {Math.min(DISCOVERY_LIMIT, books.length)}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="rounded-full bg-otto-surface px-3.5 py-2 text-[12px] font-bold text-otto-text-dim"
                >
                  Clear
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {books.map((book) => {
                  const checked = selected.includes(book.id);
                  return (
                    <label
                      key={book.id}
                      className="flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl bg-otto-surface px-3.5 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(book.id)
                              ? current.filter((id) => id !== book.id)
                              : [...current, book.id]
                          )
                        }
                        className="mt-1 h-5 w-5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14px]">{book.title}</b>
                        <span className="block truncate text-[12px] text-otto-text-dim">
                          {book.author}
                        </span>
                        <span className="mt-1 block">
                          <StarRating value={book.rating} />
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="mt-3 text-[12px] font-semibold text-otto-text-faint"
          >
            Cancel
          </button>
        </div>
      )}

      {!report && !reviewing && (
        <div className="mt-5 rounded-2xl bg-otto-surface px-5 py-8 text-center">
          <Sparkles className="mx-auto text-otto-green" />
          <h2 className="mt-3 text-[17px] font-extrabold">Recommendations from your library</h2>
          <p className="mx-auto mt-2 max-w-[460px] text-[12.5px] leading-relaxed text-otto-text-dim">
            Otto starts with the authors you have been reading. Leave them selected, pick a
            ranking, and fetch. You can turn authors off or add more first.
          </p>
          <button
            type="button"
            onClick={openReview}
            disabled={!canGenerate || generating}
            className="mt-5 rounded-xl bg-otto-green px-5 py-3 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {generating ? "Finding books…" : "Find books for me"}
          </button>
          {!canGenerate && (
            <p className="mt-3 text-[11.5px] text-otto-text-faint">
              Sign in to fetch recommendations.
            </p>
          )}
        </div>
      )}

      {report && !reviewing && (
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
                  catalogs={preferences.catalogs}
                  coverId={recommendationCovers[recommendationKey(book)]}
                  externalCovers={externalCovers}
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
                  <RecommendationCard
                    key={`${book.title}-${book.author}`}
                    book={book}
                    catalogs={preferences.catalogs}
                    coverId={recommendationCovers[recommendationKey(book)]}
                    externalCovers={externalCovers}
                  />
                ))}
              </div>
            </>
          )}
          <p className="mt-4 text-center text-[10.5px] text-otto-text-faint">
            AI-generated · verify book details before adding
          </p>
          <PromptPreview
            prompt={lastPrompt}
            title="Prompt sent to Otto"
            hint="The exact text and book sample behind these picks."
          />
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
  catalogs = [],
  coverId = null,
  externalCovers = true,
}: {
  book: BookRecommendation;
  inLibrary?: boolean;
  adding?: boolean;
  onAdd?: () => Promise<void>;
  catalogs?: BooksPreferences["catalogs"];
  coverId?: number | null;
  externalCovers?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-otto-surface px-3.5 py-3">
      <BookCover
        title={book.title}
        color={bookCoverColor(book.title)}
        size="sm"
        coverId={coverId}
        externalCovers={externalCovers}
      />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[15px]">{book.title}</b>
        <span className="block truncate text-[12px] text-otto-text-dim">{book.author}</span>
        <p className="mt-1 text-[12px] leading-snug text-otto-text-dim">{book.reason}</p>
        {book.tags.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1">
            {book.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-otto-green-soft px-2 py-0.5 text-[10.5px] font-semibold text-otto-green"
              >
                {tag}
              </span>
            ))}
          </p>
        )}
        {catalogs.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {catalogs.map((catalog) => (
              <a
                key={catalog.id}
                href={catalogSearchUrl(catalog, book.title, book.author)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-otto-divider px-2 py-1 text-[10.5px] font-semibold text-otto-text-dim"
              >
                {catalog.shortName || catalog.name}
                <ExternalLink size={10} />
              </a>
            ))}
          </p>
        )}
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

function recommendationKey(book: Pick<BookRecommendation, "title" | "author">) {
  return `${book.title.trim().toLowerCase()}\u001f${book.author.trim().toLowerCase()}`;
}

function audienceLabel(audience: BooksPreferences["audience"]): string {
  return (
    {
      adult: "Adult",
      young_adult: "Young adult",
      teen: "Teen",
      child: "Child",
      "": "",
    }[audience] ?? ""
  );
}
