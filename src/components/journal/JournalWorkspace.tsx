"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  NotebookPen,
  Pin,
  Plus,
  Settings,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { SectionPreferences } from "@/components/settings/SectionPreferences";
import { useJournal } from "@/hooks/useJournal";
import { useScreenOption } from "@/hooks/useScreenOption";
import {
  journalStreak,
  mondayOf,
  onThisDay,
  orderedNotes,
  promptForDay,
} from "@/lib/journal";
import {
  readBooksPreferences,
  writeBooksPreferences,
  type BooksPreferences,
} from "@/lib/booksPreferences";
import { fmtDate, todayISO } from "@/lib/pnl";
import type { JournalEntry, JournalKind } from "@/types/journal";

type JournalTab = "entries" | "notes" | "add" | "day" | "settings";

const TABS: { id: JournalTab; label: string; icon: LucideIcon }[] = [
  { id: "entries", label: "Entries", icon: NotebookPen },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "add", label: "Add", icon: Plus },
  { id: "day", label: "On this day", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
];

const PREFS_KEY = "trader-otto:journal-preferences";

type JournalPrefs = {
  showStreak: boolean;
  promptOfDay: boolean;
  suggestTags: boolean;
};

const DEFAULT_PREFS: JournalPrefs = {
  showStreak: true,
  promptOfDay: true,
  suggestTags: false,
};

function readPrefs(): JournalPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<JournalPrefs>;
    return {
      showStreak: parsed.showStreak !== false,
      promptOfDay: parsed.promptOfDay !== false,
      suggestTags: parsed.suggestTags === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function JournalWorkspace() {
  const journal = useJournal();
  const [tab, setTab] = useScreenOption("journalTab");
  const [prefs, setPrefs] = useState<JournalPrefs>(readPrefs);
  const [booksPrefs, setBooksPrefs] = useState<BooksPreferences>(() =>
    typeof window === "undefined"
      ? { audience: "", likedGenres: "", avoid: "", readerNotes: "", catalogs: [], logFinishedBooks: true }
      : readBooksPreferences()
  );
  const today = todayISO();
  const entries = journal.entries.filter((item) => item.kind === "entry");
  const notes = orderedNotes(journal.entries.filter((item) => item.kind === "note"));
  const streak = journalStreak(entries.map((item) => item.entryDate), today);
  const tags = useMemo(
    () => Array.from(new Set(journal.entries.flatMap((item) => item.tags))).slice(0, 12),
    [journal.entries]
  );

  function savePrefs(next: JournalPrefs) {
    setPrefs(next);
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  function saveBooks(next: BooksPreferences) {
    setBooksPrefs(next);
    writeBooksPreferences(next);
  }

  return (
    <div className="mx-auto max-w-[720px] pb-28">
      {journal.error && (
        <p className="mb-3 rounded-xl bg-otto-red-soft px-3.5 py-3 text-[12px] text-otto-red">
          {journal.error}
        </p>
      )}
      {tab === "entries" && (
        <EntriesScreen
          entries={entries}
          today={today}
          streak={streak}
          showStreak={prefs.showStreak}
          loading={journal.loading}
        />
      )}
      {tab === "notes" && (
        <NotesScreen
          notes={notes}
          loading={journal.loading}
          readonly={journal.readonly}
          onUpdate={(id, patch) => void journal.update(id, patch)}
        />
      )}
      {tab === "add" && (
        <Composer
          tags={prefs.suggestTags ? tags : []}
          showPrompt={prefs.promptOfDay}
          readonly={journal.readonly}
          onSave={async (input) => {
            await journal.add(input);
            setTab(input.kind === "note" ? "notes" : "entries");
          }}
        />
      )}
      {tab === "day" && <OnThisDay entries={onThisDay(entries, today)} today={today} />}
      {tab === "settings" && (
        <JournalSettings
          prefs={prefs}
          books={booksPrefs}
          onPrefs={savePrefs}
          onBooks={saveBooks}
        />
      )}
      <nav
        aria-label="Journal navigation"
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-otto-divider bg-otto-bg/90 px-1 pb-[calc(9px+env(safe-area-inset-bottom))] pt-[9px] backdrop-blur-[14px] desk:static desk:mt-8 desk:rounded-2xl desk:border desk:bg-otto-surface desk:pb-2"
      >
        <div className="mx-auto flex max-w-[720px]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 flex-col items-center gap-[3px] px-0 pb-1 pt-1.5 ${
                tab === id ? "text-otto-green" : "text-otto-text-faint"
              }`}
            >
              <Icon size={20} strokeWidth={tab === id ? 2.3 : 1.8} />
              <small className="text-[10px] font-semibold">{label}</small>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function EntriesScreen({
  entries,
  today,
  streak,
  showStreak,
  loading,
}: {
  entries: JournalEntry[];
  today: string;
  streak: number;
  showStreak: boolean;
  loading: boolean;
}) {
  const weekStart = mondayOf(today);
  const week = entries.filter((entry) => entry.entryDate >= weekStart);
  const earlier = entries.filter((entry) => entry.entryDate < weekStart);
  const recent = Array.from({ length: 7 }, (_, index) => offsetDay(today, index - 6));
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Journal</h1>
      {showStreak && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-otto-surface px-4 py-4">
          <div>
            <div className="text-[28px] font-black leading-none">{streak}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">
              Day streak
            </div>
          </div>
          <div className="flex gap-1.5" aria-label="Last seven days">
            {recent.map((day) => (
              <span
                key={day}
                className={`h-2.5 w-2.5 rounded-full ${
                  entries.some((entry) => entry.entryDate === day) ? "bg-otto-green" : "bg-otto-divider"
                }`}
              />
            ))}
          </div>
        </div>
      )}
      <EntryGroup title="This week" entries={week} empty={loading ? "Loading entries…" : "Nothing written this week yet."} />
      {earlier.length > 0 && <EntryGroup title="Earlier" entries={earlier} />}
    </section>
  );
}

function EntryGroup({
  title,
  entries,
  empty,
}: {
  title: string;
  entries: JournalEntry[];
  empty?: string;
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">
        {title}
      </p>
      {entries.length === 0 && empty && (
        <p className="rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">{empty}</p>
      )}
      <div className="space-y-2">
        {entries.map((entry) => {
          const [heading, ...rest] = entry.body.split("\n");
          return (
            <article key={entry.id} className="rounded-2xl bg-otto-surface px-4 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-otto-text-faint">
                {fmtDate(entry.entryDate)}
              </div>
              <h2 className="mt-1 text-[15px] font-extrabold leading-snug">{heading}</h2>
              {rest.length > 0 && (
                <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-otto-text-dim">
                  {rest.join(" ")}
                </p>
              )}
              {entry.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-otto-bg px-2 py-0.5 text-[10px] font-semibold text-otto-text-dim"
                    >
                      {entry.sourceType === "book" && <BookOpen size={10} />}
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function NotesScreen({
  notes,
  loading,
  readonly,
  onUpdate,
}: {
  notes: JournalEntry[];
  loading: boolean;
  readonly: boolean;
  onUpdate: (id: string, patch: Partial<JournalEntry>) => void;
}) {
  function move(note: JournalEntry, direction: -1 | 1) {
    const group = notes.filter(
      (item) => item.pinned === note.pinned && item.favorite === note.favorite
    );
    const index = group.findIndex((item) => item.id === note.id);
    const neighbor = group[index + direction];
    if (!neighbor) return;
    onUpdate(note.id, { sortOrder: neighbor.sortOrder });
    onUpdate(neighbor.id, { sortOrder: note.sortOrder });
  }

  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Notes</h1>
      <p className="mt-1 text-[12.5px] text-otto-text-dim">
        Pin a note to the top, star the ones you want close, and move them within that group.
      </p>
      {notes.length === 0 && (
        <p className="mt-4 rounded-2xl bg-otto-surface px-4 py-5 text-[13px] text-otto-text-dim">
          {loading ? "Loading notes…" : "Quick notes keep the date you choose, starting with today."}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {notes.map((note) => (
          <article key={note.id} className="rounded-2xl bg-otto-surface px-4 py-3.5">
            <p className="text-[14px] font-semibold leading-snug">{note.body}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-otto-text-faint">{fmtDate(note.entryDate)}</span>
              {note.tags[0] && (
                <span className="rounded-full bg-otto-bg px-2 py-0.5 text-[10px] font-semibold text-otto-text-dim">
                  {note.tags[0]}
                </span>
              )}
            </div>
            <div className="mt-2 flex gap-1">
              <NoteAction label={note.pinned ? "Unpin" : "Pin"} onClick={() => onUpdate(note.id, { pinned: !note.pinned })} disabled={readonly}>
                <Pin size={14} className={note.pinned ? "text-otto-green" : ""} />
              </NoteAction>
              <NoteAction label={note.favorite ? "Unfavorite" : "Favorite"} onClick={() => onUpdate(note.id, { favorite: !note.favorite })} disabled={readonly}>
                <Star size={14} className={note.favorite ? "fill-current text-otto-amber" : ""} />
              </NoteAction>
              <NoteAction label="Move up" onClick={() => move(note, -1)} disabled={readonly}>
                <ArrowUp size={14} />
              </NoteAction>
              <NoteAction label="Move down" onClick={() => move(note, 1)} disabled={readonly}>
                <ArrowDown size={14} />
              </NoteAction>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NoteAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-otto-bg text-otto-text-dim disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Composer({
  tags,
  showPrompt,
  readonly,
  onSave,
}: {
  tags: string[];
  showPrompt: boolean;
  readonly: boolean;
  onSave: (input: { kind: JournalKind; body: string; entryDate: string; prompt: string; tags: string[] }) => Promise<void>;
}) {
  const today = todayISO();
  const [kind, setKind] = useState<JournalKind>("entry");
  const [entryDate, setEntryDate] = useState(today);
  const prompt = promptForDay(entryDate);
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!body.trim()) {
      setError(kind === "note" ? "Write the note first." : "Write a few words first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        kind,
        body: body.trim(),
        entryDate,
        prompt: kind === "entry" && showPrompt ? prompt : "",
        tags: tag.trim() ? [tag.trim().replace(/^#/, "")] : [],
      });
      setBody("");
      setTag("");
      setEntryDate(todayISO());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold">New</h1>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || readonly}
          className="text-[14px] font-bold text-otto-green disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-otto-surface p-1.5">
        {(["entry", "note"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            className={`rounded-xl py-2.5 text-[13px] font-bold ${
              kind === item ? "bg-otto-text text-otto-bg" : "text-otto-text-dim"
            }`}
          >
            {item === "entry" ? "Journal entry" : "Quick note"}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-otto-text-faint">
          Date
        </span>
        <input
          type="date"
          value={entryDate}
          onChange={(event) => setEntryDate(event.target.value || todayISO())}
          className="w-full rounded-2xl bg-otto-surface px-4 py-2.5 text-[14px]"
        />
      </label>
      {kind === "entry" && showPrompt && (
        <p className="mt-3 rounded-xl bg-otto-green-soft px-3 py-2 text-[12.5px] font-medium text-otto-green">
          {prompt}
        </p>
      )}
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, 8000))}
        placeholder={kind === "note" ? "A note to keep…" : "Start writing…"}
        rows={8}
        className="mt-3 w-full rounded-2xl bg-otto-surface px-4 py-3 text-[15px] leading-relaxed"
      />
      <input
        value={tag}
        onChange={(event) => setTag(event.target.value.slice(0, 24))}
        placeholder="Tag, optional"
        className="mt-2 w-full rounded-full bg-otto-surface px-4 py-2.5 text-[13px]"
      />
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag(item)}
              className="rounded-full bg-otto-surface px-2.5 py-1 text-[11px] font-semibold text-otto-text-dim"
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-otto-red">{error}</p>}
    </section>
  );
}

function OnThisDay({ entries, today }: { entries: JournalEntry[]; today: string }) {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
        {fmtDate(today).replace(/,?\s*\d{4}$/, "")}
      </p>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">On this day</h1>
      {entries.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-otto-surface px-4 py-5 text-[13px] leading-relaxed text-otto-text-dim">
          Entries from this date in earlier years will gather here.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl bg-otto-surface px-4 py-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-otto-text-faint">
                {entry.entryDate.slice(0, 4)}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{entry.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function JournalSettings({
  prefs,
  books,
  onPrefs,
  onBooks,
}: {
  prefs: JournalPrefs;
  books: BooksPreferences;
  onPrefs: (next: JournalPrefs) => void;
  onBooks: (next: BooksPreferences) => void;
}) {
  return (
    <section>
      <h1 className="text-[26px] font-extrabold tracking-[-0.4px]">Journal settings</h1>
      <div className="mt-4">
        <SectionPreferences />
      </div>
      <SettingsGroup title="Writing">
        <ToggleRow
          label="Show streak on Entries"
          detail="Counts days with a journal entry"
          checked={prefs.showStreak}
          onChange={(showStreak) => onPrefs({ ...prefs, showStreak })}
        />
        <ToggleRow
          label="Prompt of the day"
          detail="A short question above a new entry"
          checked={prefs.promptOfDay}
          onChange={(promptOfDay) => onPrefs({ ...prefs, promptOfDay })}
        />
        <ToggleRow
          label="Suggest tags"
          detail="Offer tags you have used before"
          checked={prefs.suggestTags}
          onChange={(suggestTags) => onPrefs({ ...prefs, suggestTags })}
        />
      </SettingsGroup>
      <SettingsGroup title="From books">
        <ToggleRow
          label="Log finished books"
          detail="One entry on the finish date, including the review when there is one"
          checked={books.logFinishedBooks}
          onChange={(logFinishedBooks) => onBooks({ ...books, logFinishedBooks })}
        />
      </SettingsGroup>
    </section>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-otto-text-faint">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl bg-otto-surface px-4 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">{label}</span>
        <span className="mt-0.5 block text-[11.5px] text-otto-text-faint">{detail}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full ${checked ? "bg-otto-green" : "bg-otto-divider"}`}>
        <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function offsetDay(iso: string, delta: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
