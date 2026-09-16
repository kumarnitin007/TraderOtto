import type { CloseReason, Strategy } from "@/types/trade";

export type ScreenshotTradeFields = {
  ticker?: string;
  strategy?: Strategy;
  contracts?: string;
  shortStrike?: string;
  longStrike?: string;
  callShort?: string;
  callLong?: string;
  openDate?: string;
  expiry?: string;
  stockPriceOpen?: string;
  iv?: string;
  delta?: string;
  sigma?: string;
  theta?: string;
  premiumOpen?: string;
  closeDate?: string;
  premiumClose?: string;
  closed?: boolean;
  closeReason?: CloseReason;
  notes?: string;
};

/** Robinhood prints M/D for near-term rows and M/D/YY (or M/D/YYYY) for later ones. */
function parseDateParts(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day) return null;
  const explicitYear =
    year != null && Number.isFinite(year) ? (year < 100 ? 2000 + year : year) : null;
  return { month, day, explicitYear };
}

function isoDate(month: number, day: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function parseWrittenDate(value: string) {
  const match = value.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
  return month ? isoDate(month, Number(match[2]), Number(match[3])) : null;
}

function detectStrategy(
  text: string,
  strikeCount: number,
  primaryStrike?: number,
  breakeven?: number
): { strategy?: Strategy; side?: "put" | "call"; credit: boolean } {
  const lower = text.toLowerCase();
  if (lower.includes("iron condor") || (strikeCount >= 4 && lower.includes(" put") && lower.includes(" call"))) {
    return { strategy: "Iron Condor", credit: true };
  }
  if (lower.includes("strangle") || (strikeCount === 2 && lower.includes(" put") && lower.includes(" call"))) {
    return { strategy: "Strangle", credit: true };
  }
  // "Average cost" and "Date bought" mean the position was opened for a debit.
  const debit =
    lower.includes("debit") || lower.includes("average cost") || lower.includes("date bought");
  const credit = !debit && lower.includes("credit");
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
    return debit
      ? { strategy: "Long Put", side, credit: false }
      : { strategy: "Cash-Secured Put", side, credit: true };
  }
  if (strikeCount === 1 && side === "call") {
    return debit
      ? { strategy: "Long Call", side, credit: false }
      : { strategy: "Covered Call", side, credit: true };
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
  const strikes = Array.from(new Set(headerAmounts)).slice(0, 4);

  // Robinhood labels this row "Contracts" on options and "Quantity" on shares.
  const quantityMatch =
    text.match(/(?:Contracts|Quantity)\s+Current price[\s\S]{0,40}?\n?\s*(-?\d+)\s+\$[\d.]+/i) ??
    text.match(/(?:Contracts|Quantity)[\s\S]{0,30}?(-?\d+)\b/i);
  const closedContracts = text.match(/x\s+(\d+)\s+contracts?\b/i)?.[1];
  const contracts = quantityMatch
    ? String(Math.abs(Number(quantityMatch[1])) || 1)
    : closedContracts;

  const closedMatch = text.match(/Closed\s+on\s+([A-Za-z]{3,9}\s+\d{1,2},?\s*\d{4})/i);
  const closeDate = closedMatch ? parseWrittenDate(closedMatch[1]) ?? undefined : undefined;
  const closed = Boolean(closeDate);
  const closeReason: CloseReason | undefined = /assign(?:ed|ment)/i.test(text)
    ? "assigned"
    : /expir(?:ed|ation)(?:\s+worthless)?/i.test(text)
      ? "expired"
      : closed
        ? "closed"
        : undefined;

  // Realized P/L details show the reliable per-contract amounts on the two "avg" rows.
  const averageAmounts = Array.from(
    text.matchAll(/[$£]?\s*(\d+(?:\.\d+)?)\s+avg\s+x\s+100/gi)
  ).map((match) => Number(match[1]));
  const closedPremiumOpen = averageAmounts[0];
  const closedPremiumClose = averageAmounts[1];

  // Sold positions show "Average credit"; bought ones show "Average cost"/"Average debit".
  const premiumMatch = text.match(
    /Average\s+(?:credit|debit|cost)[\s\S]{0,60}?\$(\d+(?:\.\d+)?)/i
  );
  const premium = premiumMatch ? Number(premiumMatch[1]) : undefined;

  // "Date opened" on long positions, "Date sold"/"Date bought" on single legs.
  const openLabel = /Date\s+(?:opened|sold|bought)/i;
  const DATE = String.raw`\d{1,2}/\d{1,2}(?:/\d{2,4})?`;
  const datesMatch = text.match(
    new RegExp(`${openLabel.source}\\s+Expiration date[\\s\\S]{0,50}?(${DATE})\\s+(${DATE})`, "i")
  );
  let openRaw = datesMatch?.[1];
  let expiryRaw = datesMatch?.[2];
  if (!datesMatch) {
    // OCR sometimes emits the two columns as separate label/value pairs.
    openRaw = text.match(
      new RegExp(`${openLabel.source}[\\s\\S]{0,40}?(${DATE})`, "i")
    )?.[1];
    expiryRaw = text.match(new RegExp(`Expiration date[\\s\\S]{0,40}?(${DATE})`, "i"))?.[1];
  }
  if (closed && !expiryRaw) {
    expiryRaw = header.match(new RegExp(`(${DATE})(?![\\s\\S]*${DATE})`))?.[1];
  }

  const currentYear = closeDate ? Number(closeDate.slice(0, 4)) : now.getFullYear();
  const openParts = openRaw ? parseDateParts(openRaw) : null;
  const expiryParts = expiryRaw ? parseDateParts(expiryRaw) : null;
  const openDate = openParts
    ? isoDate(openParts.month, openParts.day, openParts.explicitYear ?? currentYear)
    : closeDate;
  let expiry = expiryParts
    ? isoDate(expiryParts.month, expiryParts.day, expiryParts.explicitYear ?? currentYear)
    : undefined;
  // Only roll the year forward when the screenshot did not print one.
  if (expiryParts?.explicitYear == null && openDate && expiry && expiry < openDate) {
    expiry = isoDate(expiryParts!.month, expiryParts!.day, currentYear + 1);
  }

  const breakevenMatch = text.match(/breakeven price[\s\S]{0,50}?\$(\d+(?:\.\d+)?)/i);
  const breakeven = breakevenMatch ? Number(breakevenMatch[1]) : undefined;
  const detected = detectStrategy(text, strikes.length, strikes[0], breakeven);

  let shortStrike: number | undefined = strikes[0];
  let longStrike: number | undefined = strikes[1];
  let callShortStrike: number | undefined;
  let callLongStrike: number | undefined;
  if (detected.strategy === "Iron Condor" && strikes.length >= 4) {
    const ordered = strikes.slice().sort((a, b) => a - b);
    [longStrike, shortStrike, callShortStrike, callLongStrike] = ordered;
  } else if (detected.strategy === "Strangle" && strikes.length >= 2) {
    const ordered = strikes.slice().sort((a, b) => a - b);
    shortStrike = ordered[0];
    longStrike = undefined;
    callShortStrike = ordered[ordered.length - 1];
  } else if (strikes.length >= 2 && detected.side) {
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
  const stockPriceOpen =
    text.match(/(?:stock|share|underlying)\s+price[\s\S]{0,30}?\$(\d+(?:\.\d+)?)/i)?.[1];
  const iv = text.match(/(?:implied volatility|IV)\s*[: ]\s*(\d+(?:\.\d+)?)%?/i)?.[1];
  const delta = text.match(/\bdelta\s*[: ]\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  const theta = text.match(/\btheta\s*[: ]\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  const sigma = text.match(/\b(?:sigma|vega)\s*[: ]\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  const noteParts = [
    "Imported from Robinhood screenshot.",
    closed && !openRaw ? "Open date unavailable; using close date." : "",
    currentOption ? `Screenshot option price: $${currentOption}.` : "",
  ].filter(Boolean);

  return {
    ticker,
    strategy: detected.strategy,
    contracts,
    shortStrike: shortStrike != null ? String(shortStrike) : undefined,
    longStrike: longStrike != null ? String(longStrike) : undefined,
    callShort:
      callShortStrike != null ? String(callShortStrike) : undefined,
    callLong: callLongStrike != null ? String(callLongStrike) : undefined,
    openDate,
    expiry,
    stockPriceOpen,
    iv,
    delta,
    theta,
    sigma,
    // Premium is a magnitude; direction comes from the strategy.
    premiumOpen:
      closedPremiumOpen != null
        ? String(Math.abs(closedPremiumOpen))
        : premium == null
          ? undefined
          : String(Math.abs(premium)),
    closeDate,
    premiumClose:
      closedPremiumClose == null ? undefined : String(Math.abs(closedPremiumClose)),
    closed: closed || undefined,
    closeReason,
    notes: noteParts.join(" "),
  };
}
