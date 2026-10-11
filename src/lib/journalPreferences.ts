export const JOURNAL_PREFERENCES_KEY = "trader-otto:journal-preferences";
export const JOURNAL_PREFERENCES_EVENT = "trader-otto:journal-preferences-changed";

export type JournalPrefs = {
  showStreak: boolean;
  promptOfDay: boolean;
  suggestTags: boolean;
};

export const DEFAULT_JOURNAL_PREFERENCES: JournalPrefs = {
  showStreak: true,
  promptOfDay: true,
  suggestTags: false,
};

export function readJournalPreferences(): JournalPrefs {
  if (typeof window === "undefined") return DEFAULT_JOURNAL_PREFERENCES;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(JOURNAL_PREFERENCES_KEY) ?? "{}"
    ) as Partial<JournalPrefs>;
    return {
      showStreak: parsed.showStreak !== false,
      promptOfDay: parsed.promptOfDay !== false,
      suggestTags: parsed.suggestTags === true,
    };
  } catch {
    return DEFAULT_JOURNAL_PREFERENCES;
  }
}

export function writeJournalPreferences(next: JournalPrefs) {
  window.localStorage.setItem(JOURNAL_PREFERENCES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(JOURNAL_PREFERENCES_EVENT));
}
