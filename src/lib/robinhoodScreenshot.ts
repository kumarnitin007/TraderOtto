import type { Strategy } from "@/types/trade";

export type ScreenshotTradeFields = {
  ticker?: string;
  strategy?: Strategy;
  contracts?: string;
  shortStrike?: string;
  longStrike?: string;
  openDate?: string;
  expiry?: string;
  premiumOpen?: string;
  notes?: string;
};

function isoDate(monthDay: string, year: number) {
  const [month, day] = monthDay.split("/").map(Number);
  if (!month || !day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function detectStrategy(
  text: string,
  strikeCount: number,
  primaryStrike?: number,
  breakeven?: number
): { strategy?: Strategy; side?: "put" | "call"; credit: boolean } {
  const lower = text.toLowerCase();
  const credit = lower.includes("credit");
  const debit = lower.includes("debit");
  let side: "put" | "call" | undefined;
  if (lower.includes(" put")) side = "put";
  if (lower.includes(" call")) side = "call";
  if (!side && primaryStrike != null && breakeven != null) {
    side = breakeven < primaryStrike ? "put" : "call";
  }

  if (strikeCount >= 2 && side) {
    if (side === "put" && debit) return { strategy: "Put Debit Spread", side, credit };
    if (side === "call" && debit) return { strategy: "Call Debit Spread", side, credit };
    if (side === "put") return { strategy: "Put Credit Spread", side, credit: true };
    return { strategy: "Call Credit Spread", side, credit: true };
  }
  if (strikeCount === 1 && side === "put") {
    return { strategy: "Cash-Secured Put", side, credit: true };
  }
  if (strikeCount === 1 && side === "call") {
    return { strategy: "Covered Call", side, credit: true };
  }
  return { credit };
}

export function parseRobinhoodScreenshot(
  rawText: string,
  now = new Date()
): ScreenshotTradeFields {
  const text = rawText.replace(/[|]/g, "I");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header = lines.slice(0, 4).join(" ");
  const tickerMatch = header.match(/\b([A-Z]{1,5})\s*\$(\d+(?:\.\d+)?)/);
  const ticker = tickerMatch?.[1];

  const headerAfterTicker = tickerMatch
    ? header.slice((tickerMatch.index ?? 0) + tickerMatch[0].indexOf("$"))
    : header;
  const headerAmounts = Array.from(headerAfterTicker.matchAll(/\$(\d+(?:\.\d+)?)/g))
    .map((match) => Number(match[1]))
    .filter((value) => value >= 5);
  const strikes = Array.from(new Set(headerAmounts)).slice(0, 2);

  // Robinhood labels this row "Contracts" on options and "Quantity" on shares.
  const quantityMatch =
    text.match(/(?:Contracts|Quantity)\s+Current price[\s\S]{0,40}?\n?\s*(-?\d+)\s+\$[\d.]+/i) ??
    text.match(/(?:Contracts|Quantity)[\s\S]{0,30}?(-?\d+)\b/i);
  const contracts = quantityMatch ? String(Math.abs(Number(quantityMatch[1])) || 1) : undefined;

  const premiumMatch = text.match(
    /Average\s+(?:credit|debit)[\s\S]{0,60}?\$(\d+(?:\.\d+)?)/i
  );
  const premium = premiumMatch ? Number(premiumMatch[1]) : undefined;
  const isDebit = /Average\s+debit/i.test(text);

  // "Date opened" on long positions, "Date sold"/"Date bought" on single legs.
  const openLabel = /Date\s+(?:opened|sold|bought)/i;
  const datesMatch = text.match(
    /Date\s+(?:opened|sold|bought)\s+Expiration date[\s\S]{0,50}?(\d{1,2}\/\d{1,2})\s+(\d{1,2}\/\d{1,2})/i
  );
  let openMonthDay = datesMatch?.[1];
  let expiryMonthDay = datesMatch?.[2];
  if (!datesMatch) {
    // OCR sometimes emits the two columns as separate label/value pairs.
    openMonthDay = text.match(
      new RegExp(`${openLabel.source}[\\s\\S]{0,40}?(\\d{1,2}/\\d{1,2})`, "i")
    )?.[1];
    expiryMonthDay = text.match(/Expiration date[\s\S]{0,40}?(\d{1,2}\/\d{1,2})/i)?.[1];
  }
  const currentYear = now.getFullYear();
  const openDate = openMonthDay ? isoDate(openMonthDay, currentYear) : undefined;
  let expiry = expiryMonthDay ? isoDate(expiryMonthDay, currentYear) : undefined;
  if (openDate && expiry && expiry < openDate) {
    expiry = isoDate(expiryMonthDay!, currentYear + 1);
  }

  const breakevenMatch = text.match(/breakeven price[\s\S]{0,50}?\$(\d+(?:\.\d+)?)/i);
  const breakeven = breakevenMatch ? Number(breakevenMatch[1]) : undefined;
  const detected = detectStrategy(text, strikes.length, strikes[0], breakeven);

  let shortStrike = strikes[0];
  let longStrike = strikes[1];
  if (strikes.length >= 2 && detected.side) {
    const low = Math.min(...strikes);
    const high = Math.max(...strikes);
    if (
      (detected.side === "put" && detected.credit) ||
      (detected.side === "call" && !detected.credit)
    ) {
      shortStrike = high;
      longStrike = low;
    } else {
      shortStrike = low;
      longStrike = high;
    }
  }

  const currentOptionMatch =
    text.match(
      /(?:Contracts|Quantity)\s+Current price[\s\S]{0,40}?-?\d+\s+\$(\d+(?:\.\d+)?)/i
    ) ?? text.match(/Current price[\s\S]{0,30}?\$(\d+(?:\.\d+)?)/i);
  const currentOption = currentOptionMatch?.[1];
  const noteParts = [
    "Imported from Robinhood screenshot.",
    currentOption ? `Screenshot option price: $${currentOption}.` : "",
  ].filter(Boolean);

  return {
    ticker,
    strategy: detected.strategy,
    contracts,
    shortStrike: shortStrike != null ? String(shortStrike) : undefined,
    longStrike: longStrike != null ? String(longStrike) : undefined,
    openDate,
    expiry,
    premiumOpen:
      premium == null ? undefined : String(isDebit ? -Math.abs(premium) : Math.abs(premium)),
    notes: noteParts.join(" "),
  };
}
