export type BookStatus = "reading" | "read" | "want_to_read";

export type BookShelf = {
  id: string;
  name: string;
  slug: string;
  builtin: boolean;
};
export type BookFormat = "print" | "ebook" | "audiobook" | "other";

export type BookJournal = {
  description: string;
  favoriteCharacter: string;
  sceneSummary: string;
  memorableMoments: string;
  leastFavoritePart: string;
  genre: string;
  bookshelfType: "" | "regular" | "wishlist";
  coverUrl: string;
};

export const EMPTY_BOOK_JOURNAL: BookJournal = {
  description: "",
  favoriteCharacter: "",
  sceneSummary: "",
  memorableMoments: "",
  leastFavoritePart: "",
  genre: "",
  bookshelfType: "",
  coverUrl: "",
};

export type Book = {
  id: string;
  userId: string;
  title: string;
  author: string;
  status: string;
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
  favorite: boolean;
  journal: BookJournal;
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
  subjects: string[];
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
