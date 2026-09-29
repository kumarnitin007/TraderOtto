export type JournalKind = "entry" | "note";

export type JournalEntry = {
  id: string;
  kind: JournalKind;
  body: string;
  entryDate: string;
  prompt: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  sortOrder: number;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JournalInput = {
  kind: JournalKind;
  body: string;
  entryDate: string;
  prompt?: string;
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
  sortOrder?: number;
  sourceType?: string | null;
  sourceId?: string | null;
};
