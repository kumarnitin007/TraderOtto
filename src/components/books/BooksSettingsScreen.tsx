"use client";

import { FormEvent, useRef, useState } from "react";
import {
  BookImage,
  Download,
  Library,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { LibraryCheck } from "@/components/books/LibraryCheck";
import { SettingsRow } from "@/components/settings/SettingsPrimitives";
import {
  KNOWN_BOOK_CATALOGS,
  type BooksPreferences,
  type ReaderAudience,
} from "@/lib/booksPreferences";
import type { CleanupAction } from "@/lib/bookCleanup";
import type { Book, BookShelf } from "@/types/book";

export function BooksSettingsScreen({
  books,
  shelves,
  preferences,
  onPreferencesChange,
  openLibraryEnabled,
  onOpenLibraryChange,
  onAddShelf,
  onRemoveShelf,
  onExport,
  onImport,
  onApplyCleanup,
}: {
  books: Book[];
  shelves: BookShelf[];
  preferences: BooksPreferences;
  onPreferencesChange: (preferences: BooksPreferences) => void;
  openLibraryEnabled: boolean;
  onOpenLibraryChange: (enabled: boolean) => void;
  onAddShelf: (name: string) => Promise<void>;
  onRemoveShelf: (shelf: BookShelf, destination?: string) => Promise<void>;
  onExport: (format: "json" | "csv") => void;
  onImport: (file: File) => Promise<void>;
  onApplyCleanup: (actions: CleanupAction[]) => Promise<void>;
}) {
  const [shelfName, setShelfName] = useState("");
  const [shelfError, setShelfError] = useState("");
  const [removingShelf, setRemovingShelf] = useState<BookShelf | null>(null);
  const [moveTo, setMoveTo] = useState("want_to_read");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [catalogName, setCatalogName] = useState("");
  const [catalogShort, setCatalogShort] = useState("");
  const [catalogUrl, setCatalogUrl] = useState("");

  async function importFile(file: File) {
    setImporting(true);
    setImportError("");
    try {
      await onImport(file);
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Could not import that file.");
    } finally {
      setImporting(false);
    }
  }

  async function addShelf(event: FormEvent) {
    event.preventDefault();
    const name = shelfName.trim();
    if (!name) return;
    setShelfError("");
    try {
      await onAddShelf(name);
      setShelfName("");
    } catch (cause) {
      setShelfError(cause instanceof Error ? cause.message : "Could not add this shelf.");
    }
  }

  function patchPreferences(patch: Partial<BooksPreferences>) {
    onPreferencesChange({ ...preferences, ...patch });
  }

  function addKnownCatalog(id: string) {
    const catalog = KNOWN_BOOK_CATALOGS.find((item) => item.id === id);
    if (
      !catalog ||
      preferences.catalogs.length >= 3 ||
      preferences.catalogs.some((item) => item.id === id)
    ) {
      return;
    }
    patchPreferences({ catalogs: [...preferences.catalogs, catalog] });
  }

  function addCustomCatalog(event: FormEvent) {
    event.preventDefault();
    const name = catalogName.trim();
    const shortName = (catalogShort.trim() || name).slice(0, 16);
    const searchUrl = catalogUrl.trim();
    if (!name || !shortName || !/^https?:\/\//i.test(searchUrl) || preferences.catalogs.length >= 3) {
      return;
    }
    patchPreferences({
      catalogs: [
        ...preferences.catalogs,
        { id: `custom-${Date.now()}`, name, shortName, searchUrl },
      ],
    });
    setCatalogName("");
    setCatalogShort("");
    setCatalogUrl("");
  }

  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Books preferences
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Settings</h1>

      <details className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
          <UserRound size={18} className="text-otto-text-dim" />
          <span>
            <b className="block text-[14px]">Reader profile</b>
            <span className="text-[12px] text-otto-text-dim">
              Optional context for better AI suggestions
            </span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-otto-divider px-3.5 py-3.5">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
              Audience
            </span>
            <select
              value={preferences.audience}
              onChange={(event) =>
                patchPreferences({ audience: event.target.value as ReaderAudience })
              }
              className="mt-1.5 w-full rounded-xl border border-otto-divider bg-otto-bg px-3 py-2.5 text-[14px]"
            >
              <option value="">Not specified</option>
              <option value="adult">Adult</option>
              <option value="young_adult">Young adult</option>
              <option value="teen">Teen</option>
              <option value="child">Child</option>
            </select>
          </label>
          <SettingsInput
            label="Genres I enjoy"
            value={preferences.likedGenres}
            placeholder="Mystery, history, literary fiction"
            onChange={(likedGenres) => patchPreferences({ likedGenres })}
          />
          <SettingsInput
            label="Avoid"
            value={preferences.avoid}
            placeholder="Children's books, graphic violence"
            onChange={(avoid) => patchPreferences({ avoid })}
          />
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
              Anything else
            </span>
            <textarea
              value={preferences.readerNotes}
              onChange={(event) =>
                patchPreferences({ readerNotes: event.target.value.slice(0, 500) })
              }
              placeholder="Optional reading preferences"
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-otto-divider bg-otto-bg px-3 py-2.5 text-[14px]"
            />
          </label>
        </div>
      </details>

      <details className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
          <MapPin size={18} className="text-otto-text-dim" />
          <span>
            <b className="block text-[14px]">Local libraries</b>
            <span className="text-[12px] text-otto-text-dim">
              {preferences.catalogs.length ? `${preferences.catalogs.length} connected` : "Optional · up to 3"}
            </span>
          </span>
        </summary>
        <div className="border-t border-otto-divider px-3.5 py-3.5">
          <p className="text-[12px] leading-relaxed text-otto-text-dim">
            Catalog buttons open a search for each recommended title. Availability remains on the
            library site.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {KNOWN_BOOK_CATALOGS.map((catalog) => {
              const added = preferences.catalogs.some((item) => item.id === catalog.id);
              return (
                <button
                  key={catalog.id}
                  type="button"
                  onClick={() => addKnownCatalog(catalog.id)}
                  disabled={added || preferences.catalogs.length >= 3}
                  className="rounded-full border border-otto-divider px-3 py-2 text-[11.5px] font-semibold disabled:opacity-45"
                >
                  {added ? "Added" : "Add"} {catalog.shortName}
                </button>
              );
            })}
          </div>
          {preferences.catalogs.map((catalog) => (
            <div key={catalog.id} className="mt-2 flex items-center gap-2 rounded-xl bg-otto-bg px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{catalog.name}</span>
              <input
                value={catalog.shortName}
                onChange={(event) =>
                  patchPreferences({
                    catalogs: preferences.catalogs.map((item) =>
                      item.id === catalog.id
                        ? { ...item, shortName: event.target.value.slice(0, 16) }
                        : item
                    ),
                  })
                }
                aria-label={`Short name for ${catalog.name}`}
                className="w-20 shrink-0 rounded-lg border border-otto-divider bg-otto-surface px-2 py-1 text-center text-[12px] font-bold"
              />
              <button
                type="button"
                onClick={() =>
                  patchPreferences({
                    catalogs: preferences.catalogs.filter((item) => item.id !== catalog.id),
                  })
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center text-otto-text-dim"
                aria-label={`Remove ${catalog.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <form onSubmit={addCustomCatalog} className="mt-3 space-y-2">
            <input
              value={catalogName}
              onChange={(event) => setCatalogName(event.target.value)}
              placeholder="Library name"
              maxLength={80}
              disabled={preferences.catalogs.length >= 3}
              className="w-full rounded-xl border border-otto-divider bg-otto-bg px-3 py-2.5 text-[13px]"
            />
            <input
              value={catalogShort}
              onChange={(event) => setCatalogShort(event.target.value)}
              placeholder="Short name, such as KCLS"
              maxLength={16}
              disabled={preferences.catalogs.length >= 3}
              className="w-full rounded-xl border border-otto-divider bg-otto-bg px-3 py-2.5 text-[13px]"
            />
            <input
              value={catalogUrl}
              onChange={(event) => setCatalogUrl(event.target.value)}
              placeholder="Search URL with {query}"
              maxLength={500}
              disabled={preferences.catalogs.length >= 3}
              className="w-full rounded-xl border border-otto-divider bg-otto-bg px-3 py-2.5 text-[13px]"
            />
            <button
              type="submit"
              disabled={
                preferences.catalogs.length >= 3 ||
                !catalogName.trim() ||
                !/^https?:\/\//i.test(catalogUrl.trim())
              }
              className="rounded-xl bg-otto-green px-3.5 py-2.5 text-[12px] font-bold text-white disabled:opacity-40"
            >
              Add custom library
            </button>
          </form>
        </div>
      </details>

      <details className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
          <Library size={18} className="text-otto-text-dim" />
          <span>
            <b className="block text-[14px]">Shelves</b>
            <span className="text-[12px] text-otto-text-dim">
              {shelves.filter((shelf) => !shelf.builtin).length
                ? `${shelves.filter((shelf) => !shelf.builtin).length} custom`
                : "Reading, Read, and Want to read"}
            </span>
          </span>
        </summary>
        <div className="mx-3.5 border-t border-otto-divider" />
        {shelves
          .filter((shelf) => !shelf.builtin)
          .map((shelf, index) => {
            const bookCount = books.filter((book) => book.status === shelf.slug).length;
            const destinations = shelves.filter((item) => item.slug !== shelf.slug);
            return (
              <div
                key={shelf.id}
                className={`px-3.5 py-2.5 ${index > 0 ? "border-t border-otto-divider" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold">{shelf.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShelfError("");
                      setRemovingShelf(shelf);
                      setMoveTo("want_to_read");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-otto-text-dim"
                    aria-label={`Remove ${shelf.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {removingShelf?.id === shelf.id && (
                  <div className="mt-2 rounded-xl bg-otto-bg px-3 py-3">
                    <p className="text-[12.5px] leading-snug text-otto-text-dim">
                      {bookCount === 0
                        ? "This shelf is empty."
                        : `${bookCount} book${bookCount === 1 ? "" : "s"} will move.`}
                    </p>
                    {bookCount > 0 && (
                      <div className="mt-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
                          Move books to
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {destinations.map((item) => (
                            <button
                              key={item.slug}
                              type="button"
                              onClick={() => setMoveTo(item.slug)}
                              className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                                moveTo === item.slug
                                  ? "bg-otto-text text-otto-bg"
                                  : "bg-otto-surface text-otto-text-dim"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRemovingShelf(null)}
                        className="rounded-xl bg-otto-surface px-3 py-2 text-[12.5px] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void onRemoveShelf(shelf, bookCount > 0 ? moveTo : undefined)
                            .then(() => setRemovingShelf(null))
                            .catch((cause: unknown) =>
                              setShelfError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Could not remove this shelf."
                              )
                            );
                        }}
                        className="rounded-xl bg-otto-red-soft px-3 py-2 text-[12.5px] font-bold text-otto-red"
                      >
                        Remove shelf
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        <form onSubmit={(event) => void addShelf(event)} className="flex gap-2 px-3.5 pb-3.5 pt-2">
          <input
            value={shelfName}
            onChange={(event) => setShelfName(event.target.value)}
            placeholder="New shelf"
            maxLength={40}
            className="min-w-0 flex-1 rounded-[10px] border border-otto-divider bg-otto-bg px-3 py-2 text-[14px]"
          />
          <button
            type="submit"
            disabled={!shelfName.trim()}
            className="rounded-xl bg-otto-green px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            Add
          </button>
        </form>
        {shelfError && (
          <p className="px-3.5 pb-3 text-[12px] text-otto-red">{shelfError}</p>
        )}
      </details>

      <LibraryCheck
        books={books}
        openLibraryEnabled={openLibraryEnabled}
        onApply={onApplyCleanup}
      />

      <details className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
          <Download size={18} className="text-otto-text-dim" />
          <span>
            <b className="block text-[14px]">Import / export</b>
            <span className="text-[12px] text-otto-text-dim">{books.length} books</span>
          </span>
        </summary>
        <div className="border-t border-otto-divider">
        <SettingsRow
          icon={Upload}
          label="Import JSON"
          detail={importing ? "Importing…" : "Bookshelf export"}
          onClick={() => jsonRef.current?.click()}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Upload}
          label="Import CSV"
          detail={importing ? "Importing…" : "Bookshelf export"}
          onClick={() => csvRef.current?.click()}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Download}
          label="Export JSON"
          detail={`${books.length} books`}
          onClick={() => onExport("json")}
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Download}
          label="Export CSV"
          detail={`${books.length} books`}
          onClick={() => onExport("csv")}
        />
        <input
          ref={jsonRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importFile(file);
          }}
        />
        <input
          ref={csvRef}
          type="file"
          accept="text/csv,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importFile(file);
          }}
        />
        {importError && <p className="px-3.5 pb-3 text-[12px] text-otto-red">{importError}</p>}
        </div>
      </details>

      <div className="mt-3 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={BookImage}
          label="Open Library covers"
          detail={openLibraryEnabled ? "On" : "Off"}
          onClick={() => onOpenLibraryChange(!openLibraryEnabled)}
          trailing={
            <span
              aria-hidden
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                openLibraryEnabled ? "bg-otto-green" : "bg-otto-divider"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  openLibraryEnabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
          }
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={Sparkles}
          label="AI recommendations"
          detail="On request only"
        />
        <div className="mx-3.5 border-t border-otto-divider" />
        <SettingsRow
          icon={ShieldCheck}
          label="Library privacy"
          detail="Private to your account"
        />
      </div>

      <p className="mt-5 rounded-xl bg-otto-surface px-4 py-3 text-[12px] leading-relaxed text-otto-text-dim">
        Discover shows the books and reviews it will send, and only includes the ones you leave
        checked. Open Library searches and cover requests stop completely when its setting is off.
      </p>
    </section>
  );
}

function SettingsInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-otto-text-faint">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 300))}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-otto-divider bg-otto-bg px-3 py-2.5 text-[14px]"
      />
    </label>
  );
}
