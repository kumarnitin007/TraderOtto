import { describe, expect, it } from "vitest";
import { selectDiscoveryBooks } from "@/lib/booksDiscovery";

function library(ratings: number[]) {
  return ratings.map((rating, index) => ({ id: `b${index}`, rating }));
}

describe("discovery selection", () => {
  it("sends the seven best and three worst rated books", () => {
    const books = library([1, 2, 3, 3.5, 4, 4.5, 5, 5, 4, 2.5, 1.5, 3, 5, 4.5, 2]);
    const picked = selectDiscoveryBooks(books);
    expect(picked).toHaveLength(10);
    const ratings = picked.map((book) => book.rating);
    expect(ratings.slice(0, 7)).toEqual([5, 5, 5, 4.5, 4.5, 4, 4]);
    expect(ratings.slice(7)).toEqual([1, 1.5, 2]);
  });

  it("keeps a small library whole", () => {
    const books = library([5, 1, 3]);
    expect(selectDiscoveryBooks(books)).toHaveLength(3);
  });

  it("fills with unrated books when there are too few ratings", () => {
    const books = library([5, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const picked = selectDiscoveryBooks(books);
    expect(picked).toHaveLength(10);
    expect(picked.filter((book) => book.rating > 0)).toHaveLength(2);
  });
});
