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

function digitRuns(value: string) {
  return [...value.matchAll(/\d[\d \t-]{2,}\d/g)]
    .map((match) => match[0].replace(/\D/g, ""))
    .filter((digits) => digits.length >= 3);
}

function nearbyValue(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  return lines.slice(index, index + 3).join(" ");
}

function standaloneCode(line: string) {
  const trimmed = line.trim();
  if (!/^\d[\d \t-]{1,10}\d$/.test(trimmed)) return "";
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 3 && digits.length <= 8 ? digits : "";
}

export function parseGiftCardText(text: string): GiftCardScanResult {
  const clean = text.replace(/\r/g, "");
  const lines = clean
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const cardLabel = /card\s*(?:number|no\.?|#)|gift\s*card\s*(?:number|no\.?|#)/i;
  const pinLabel = /\b(?:p[i1l|]n|ref(?:erence)?(?:\s*(?:no\.?|number|#))?)\b/i;
  const labeledCard = digitRuns(nearbyValue(lines, cardLabel)).find(isCardNumber);
  const cardNumber =
    labeledCard ??
    digitRuns(clean).filter(isCardNumber).sort((a, b) => b.length - a.length)[0] ??
    "";
  const labeledPin = digitRuns(nearbyValue(lines, pinLabel)).find((digits) => isPin(digits, cardNumber));
  const cardLine = lines.findIndex((line) => cardNumber && line.replace(/\D/g, "").includes(cardNumber));
  const standalonePin =
    lines.slice(cardLine + 1).map(standaloneCode).find((digits) => isPin(digits, cardNumber)) ?? "";
  const pin = labeledPin || standalonePin;
  const balanceMatch = clean.match(/\$\s*\d+(?:[.,]\d{1,2})?/);
  const balance = balanceMatch?.[0].replace(/\s/g, "").replace(",", ".") ?? "";
  const website = merchantWebsite(clean);
  const name = merchantName(lines, cardNumber);

  return {
    name,
    cardNumber,
    pin,
    balance,
    category: giftCardCategory(name),
    website: website.replace(/[.,)]$/, ""),
  };
}

function isCardNumber(digits: string) {
  return digits.length >= 12 && digits.length <= 24;
}

function isPin(digits: string, cardNumber: string) {
  return digits.length >= 3 && digits.length <= 8 && !cardNumber.includes(digits);
}

function merchantWebsite(text: string) {
  const matches = text.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?/gi) ?? [];
  const site = matches.find((url) => !isTrackingUrl(url));
  return site?.replace(/^(?:https?:\/\/)?(?:www\.)?/, "").replace(/[.,)]$/, "") ?? "";
}

function isTrackingUrl(url: string) {
  const [host = "", ...path] = url.replace(/^https?:\/\//, "").split("/");
  if (/igs4ds\.net|cashstar|vcdelivery|launchgiftcards|egifter/i.test(host)) return true;
  return path.length > 0 && path.every((part) => /^c$|^\d+$/.test(part));
}

function merchantName(lines: string[], cardNumber: string) {
  const ranked = lines
    .map((line, index) => {
      const cleaned = line.replace(/\$\s*\d+(?:[.,]\d{1,2})?/, "").replace(/\s+/g, " ").trim();
      return { line: cleaned, index, score: merchantScore(cleaned, cardNumber) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.line ?? "";
}

function merchantScore(line: string, cardNumber: string) {
  const compact = line.replace(/\D/g, "");
  if (cardNumber && compact.includes(cardNumber)) return 0;
  if ((line.match(/\d/g) ?? []).length >= 6) return 0;
  if (
    /^(?:card|gift card|pin|ref(?:erence)?|balance)\b|barcode|redeem|register|checkout|online|cashier|payment|enter |print this|done|visit any|eGift|log on|box office|concession|balance of|https?:|www\.|\.com|\.net/i.test(
      line
    )
  ) {
    return 0;
  }
  const letters = (line.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 2 || line.length > 32) return 0;
  return letters * 3 - line.length;
}
