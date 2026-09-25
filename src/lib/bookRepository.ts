import type {
  Book,
  BookDiscoveryReport,
  BookInput,
  StoredBookDiscoveryReport,
} from "@/types/book";

export type BookRepository = {
  list(): Promise<Book[]>;
  save(input: BookInput, id?: string): Promise<Book>;
  remove(id: string): Promise<void>;
  latestDiscovery(): Promise<StoredBookDiscoveryReport | null>;
  saveDiscovery(
    report: BookDiscoveryReport,
    model: string
  ): Promise<StoredBookDiscoveryReport>;
};
