export type WatchTracker = {
  id: string;
  ticker: string;
  lowerTrigger: number | null;
  upperTrigger: number | null;
  notes: string;
  earningsDate: string | null;
  earningsTiming: string | null;
  earningsCheckedAt: string | null;
  sector: string | null;
  sectorCheckedAt: string | null;
};

export type WatchTrackerPatch = Partial<Omit<WatchTracker, "id" | "ticker">>;

export type WatchGroup = {
  id: string;
  name: string;
  trackers: WatchTracker[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
