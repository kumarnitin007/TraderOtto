export type WatchTracker = {
  id: string;
  ticker: string;
  lowerTrigger: number | null;
  upperTrigger: number | null;
  notes: string;
};

export type WatchGroup = {
  id: string;
  name: string;
  trackers: WatchTracker[];
  createdAt: string;
  updatedAt: string;
};
