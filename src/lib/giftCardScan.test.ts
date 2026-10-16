import { describe, expect, it } from "vitest";
import { parseGiftCardText } from "@/lib/giftCardScan";

describe("gift card image text", () => {
  it("reads a gift card number, PIN, balance, and category", () => {
    expect(
      parseGiftCardText(`
        AMC Theatres
        $3.50
        CARD NUMBER
        9999 8888 7777 6666
        PIN
        1234
      `)
    ).toEqual({
      name: "AMC Theatres",
      cardNumber: "9999888877776666",
      pin: "1234",
      balance: "$3.50",
      category: "Entertainment",
      website: "",
    });
  });

  it("accepts reference numbers used instead of PINs", () => {
    const parsed = parseGiftCardText(`
      Old Navy
      $7.17
      CARD NUMBER
      1111222233334444
      REF NO
      5678
      Show barcode at register, or enter online at gap.igs4ds.net/c/202866/
    `);
    expect(parsed.name).toBe("Old Navy");
    expect(parsed.cardNumber).toBe("1111222233334444");
    expect(parsed.pin).toBe("5678");
    expect(parsed.category).toBe("Retail");
  });
});
