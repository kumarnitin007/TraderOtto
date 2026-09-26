import type {
  Book,
  BookDiscoveryReport,
  BookInput,
  BookShelf,
  StoredBookDiscoveryReport,
} from "@/types/book";

export type BookRepository = {
  list(): Promise<Book[]>;
  listShelves(): Promise<BookShelf[]>;
  saveShelf(name: string): Promise<BookShelf>;
  removeShelf(id: string, destination?: string): Promise<void>;
  save(input: BookInput, id?: string): Promise<Book>;
  remove(id: string): Promise<void>;
  latestDiscovery(): Promise<StoredBookDiscoveryReport | null>;
  saveDiscovery(
    report: BookDiscoveryReport,
    model: string
  ): Promise<StoredBookDiscoveryReport>;
};
