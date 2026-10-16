export const GIFT_CARD_CATEGORIES = [
  "Retail",
  "Dining",
  "Entertainment",
  "Travel",
  "Grocery",
  "Other",
] as const;

export type GiftCardCategory = (typeof GIFT_CARD_CATEGORIES)[number];

export type GiftCardScanResult = {
  name: string;
  cardNumber: string;
  pin: string;
  balance: string;
  category: GiftCardCategory;
  website: string;
};

const DINING = /applebee|papa john|restaurant|grill|pizza|cafe|coffee/i;
const ENTERTAINMENT = /amc|theatre|theater|cinema|movie/i;
const TRAVEL = /airline|hotel|airbnb|uber|lyft|travel/i;
const GROCERY = /grocery|market|foods|kroger|safeway|whole foods/i;

export function giftCardCategory(name: string): GiftCardCategory {
  if (DINING.test(name)) return "Dining";
  if (ENTERTAINMENT.test(name)) return "Entertainment";
  if (TRAVEL.test(name)) return "Travel";
  if (GROCERY.test(name)) return "Grocery";
  return name.trim() ? "Retail" : "Other";
}

export function parseGiftCardText(text: string): GiftCardScanResult {
  const clean = text.replace(/\r/g, "");
  const lines = clean
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const labeled = (label: RegExp) => {
    const index = lines.findIndex((line) => label.test(line));
    if (index < 0) return "";
    const inline = lines[index].replace(label, "").replace(/^[:#\s-]+/, "").trim();
    return inline || lines[index + 1] || "";
  };
  const digits = (value: string) => (value.match(/\d[\d\s-]{2,}\d/)?.[0] ?? "").replace(/\D/g, "");
  const cardNumber = digits(labeled(/^(card\s*(number|no\.?)|gift\s*card\s*(number|no\.?))/i));
  const pin = digits(labeled(/^(pin|ref(?:erence)?\s*(number|no\.?))/i));
  const balanceMatch = clean.match(/\$\s*\d+(?:[.,]\d{1,2})?/);
  const balance = balanceMatch?.[0].replace(/\s/g, "").replace(",", ".") ?? "";
  const website = clean.match(/(?:https?:\/\/|www\.)[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?/i)?.[0] ?? "";
  const ignored =
    /^(card|gift card|pin|ref|reference|balance|done|online|in store|5g|lte|wifi)/i;
  const cardLabelIndex = lines.findIndex((line) =>
    /^(card\s*(number|no\.?)|gift\s*card\s*(number|no\.?))/i.test(line)
  );
  const possibleNames = (cardLabelIndex > 0 ? lines.slice(0, cardLabelIndex) : lines).filter(
    (line) =>
      !ignored.test(line) &&
      !/^\$/.test(line) &&
      !/^\d{1,2}:\d{2}/.test(line) &&
      !/^\d[\d\s-]{3,}$/.test(line) &&
      line.length <= 40
  );
  const name = possibleNames.at(-1) ?? "";

  return {
    name,
    cardNumber,
    pin,
    balance,
    category: giftCardCategory(name),
    website,
  };
}
