import type { JournalEntry } from "@/types/journal";

export const JOURNAL_PROMPTS = [
  "What's one thing that went well today?",
  "What did you finish, and how did it feel?",
  "What are you glad you did not rush?",
  "What is one small thing you want to remember?",
  "What felt harder than it needed to be?",
  "Who or what did you pay attention to today?",
  "What would make tomorrow a little lighter?",
  "What did you read, watch, or notice?",
];

function dayNumber(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

export function promptForDay(iso: string) {
  return JOURNAL_PROMPTS[dayNumber(iso) % JOURNAL_PROMPTS.length];
}

function formatIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function previousIso(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return formatIso(date);
}

export function mondayOf(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDay();
  const distance = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - distance);
  return formatIso(date);
}

/** Consecutive entry days ending today, or yesterday if today is still empty. */
export function journalStreak(dates: string[], today: string) {
  const unique = new Set(dates);
  let cursor = unique.has(today) ? today : previousIso(today);
  if (!unique.has(cursor)) return 0;
  let count = 0;
  while (unique.has(cursor)) {
    count += 1;
    cursor = previousIso(cursor);
  }
  return count;
}

export function orderedNotes(notes: JournalEntry[]) {
  return [...notes].sort(
    (left, right) =>
      Number(right.pinned) - Number(left.pinned) ||
      Number(right.favorite) - Number(left.favorite) ||
      left.sortOrder - right.sortOrder ||
      right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function onThisDay(entries: JournalEntry[], today: string) {
  const monthDay = today.slice(5);
  const year = today.slice(0, 4);
  return entries
    .filter(
      (entry) =>
        entry.kind === "entry" &&
        entry.entryDate.slice(5) === monthDay &&
        entry.entryDate.slice(0, 4) !== year
    )
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate));
}

export function finishedBookBody(book: {
  title: string;
  author: string;
  rating: number;
  notes: string;
}) {
  const lines = [`Finished "${book.title.trim()}" by ${book.author.trim() || "an unknown author"}`];
  if (book.rating > 0) lines.push(`Rated ${book.rating} out of 5.`);
  const review = book.notes.trim();
  lines.push(review || "Add a few words about it?");
  return lines.join("\n");
}
