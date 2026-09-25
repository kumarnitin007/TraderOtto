"use client";

import { BookImage, Download, ShieldCheck, Sparkles } from "lucide-react";
import { SettingsRow } from "@/components/settings/SettingsPrimitives";
import type { Book } from "@/types/book";

export function BooksSettingsScreen({
  books,
  openLibraryEnabled,
  onOpenLibraryChange,
}: {
  books: Book[];
  openLibraryEnabled: boolean;
  onOpenLibraryChange: (enabled: boolean) => void;
}) {
  function exportBooks() {
    const blob = new Blob([JSON.stringify(books, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `otto-books-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        Books preferences
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Settings</h1>

      <div className="mt-5 overflow-hidden rounded-2xl bg-otto-surface">
        <SettingsRow
          icon={Download}
          label="Export library"
          detail={`${books.length} books`}
          onClick={exportBooks}
        />
      </div>

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
        Discover sends your saved book titles, ratings, tags, and notes to the configured AI
        provider only when you request new recommendations. Open Library searches and cover
        requests stop completely when its setting is off.
      </p>
    </section>
  );
}
