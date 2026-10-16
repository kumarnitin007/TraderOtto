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

  it("reads a PIN when the PIN label is missed and keeps the store site", () => {
    const parsed = parseGiftCardText(`
      AMC Theatres $3.50
      999988887777 6666 & x
      1234
      eGift card is redeemable online and in
      theatre at any box office or concession
      register. To obtain the current balance of
      your eGift card log on to amctheatres.com
      or visit any AMC Theatre.
    `);
    expect(parsed.name).toBe("AMC Theatres");
    expect(parsed.cardNumber).toBe("9999888877776666");
    expect(parsed.pin).toBe("1234");
    expect(parsed.balance).toBe("$3.50");
    expect(parsed.website).toBe("amctheatres.com");
    expect(parsed.category).toBe("Entertainment");
  });

  it("ignores a gift-card redemption tracking link", () => {
    const parsed = parseGiftCardText(`
      GAP
      $0.77
      CARD NUMBER
      1111222233334444
      REF NO
      5678
      enter online at cards.igs4ds.net/c/100/200/300
    `);
    expect(parsed.name).toBe("GAP");
    expect(parsed.pin).toBe("5678");
    expect(parsed.website).toBe("");
  });

  it("keeps a noisy card-number line out of the title", () => {
    const parsed = parseGiftCardText(`
      12:42
      Old Navy
      $7.17
      1111222233334444 — _
      REF NO
      5678
      Show barcode at register, or enter online at shop.example.net/redeem
    `);
    expect(parsed.name).toBe("Old Navy");
    expect(parsed.cardNumber).toBe("1111222233334444");
    expect(parsed.pin).toBe("5678");
    expect(parsed.balance).toBe("$7.17");
    expect(parsed.category).toBe("Retail");
    expect(parsed.website).toBe("shop.example.net/redeem");
  });
});
