export type BookStatus = "reading" | "read" | "want_to_read";
export type BookFormat = "print" | "ebook" | "audiobook" | "other";

export type Book = {
  id: string;
  userId: string;
  title: string;
  author: string;
  status: BookStatus;
  progressPercent: number;
  rating: number;
  wouldRecommend: boolean | null;
  format: BookFormat;
  pageCount: number | null;
  durationMinutes: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string;
  tags: string[];
  seriesTitle: string;
  seriesIndex: number | null;
  isbn: string;
  openLibraryId: string;
  coverId: number | null;
  coverColor: string;
  createdAt: string;
  updatedAt: string;
};

export type BookInput = Omit<Book, "id" | "userId" | "createdAt" | "updatedAt">;

export type OpenLibraryBook = {
  title: string;
  author: string;
  isbn: string;
  openLibraryId: string;
  coverId: number | null;
  pageCount: number | null;
  firstPublishYear: number | null;
};

export type BookRecommendation = {
  title: string;
  author: string;
  reason: string;
  tags: string[];
};

export type BookDiscoveryReport = {
  generatedAt: string;
  profile: string;
  recommendations: BookRecommendation[];
  notForYou: BookRecommendation[];
};

export type StoredBookDiscoveryReport = BookDiscoveryReport & {
  id: string;
  model: string;
  createdAt: string;
};
