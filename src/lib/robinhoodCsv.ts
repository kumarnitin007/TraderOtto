import { realizedPnl, monthKey } from "@/lib/pnl";
import type { CloseReason, Strategy, TradeImport } from "@/types/trade";

const OPTION_CODES = new Set([
  "STO",
  "BTO",
  "STC",
  "BTC",
  "OEXP",
  "OASGN",
  "OEXCS",
]);

export type RobinhoodImportConfidence = "ready" | "needs_review" | "unsupported";

export type RobinhoodRawEventRef = {
  rowIndex: number;
  activityDate: string;
  transCode: string;
  description: string;
};

export type RobinhoodImportIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type RobinhoodTradeCandidate = {
  sourceFingerprint: string;
  confidence: RobinhoodImportConfidence;
  issues: RobinhoodImportIssue[];
  rawEventRefs: RobinhoodRawEventRef[];
  ticker: string;
  strategy: Strategy | string;
  contracts: number;
  expiry: string;
  openDate: string;
  shortStrike: number | null;
  longStrike: number | null;
  callShortStrike: number | null;
  callLongStrike: number | null;
  stockPriceOpen: number;
  iv: number;
  delta: number;
  sigma: number;
  theta: number;
  premiumOpen: number;
  status: "open" | "closed";
  closeDate: string | null;
  stockPriceClose: number | null;
  premiumClose: number | null;
  commissionOpen: number;
  commissionClose?: number;
  closeReason?: CloseReason;
  notes: string;
};

export type RobinhoodImportSummary = {
  totalCandidates: number;
  openCount: number;
  closedCount: number;
  readyCount: number;
  needsReviewCount: number;
  unsupportedCount: number;
  byStrategy: Record<string, number>;
  monthlyRealizedPnl: Record<string, number>;
};

export type RobinhoodParseResult = {
  candidates: RobinhoodTradeCandidate[];
  unsupportedRows: RobinhoodRawEventRef[];
  summary: RobinhoodImportSummary;
};

export function robinhoodCandidateToTradeImport(
  candidate: RobinhoodTradeCandidate
): TradeImport {
  return {
    ticker: candidate.ticker,
    strategy: candidate.strategy,
    contracts: candidate.contracts,
    expiry: candidate.expiry,
    openDate: candidate.openDate,
    shortStrike: candidate.shortStrike,
    longStrike: candidate.longStrike,
    callShortStrike: candidate.callShortStrike,
    callLongStrike: candidate.callLongStrike,
    stockPriceOpen: candidate.stockPriceOpen,
    iv: candidate.iv,
    delta: candidate.delta,
    sigma: candidate.sigma,
    theta: candidate.theta,
    premiumOpen: candidate.premiumOpen,
    commissionOpen: candidate.commissionOpen,
    rolledFromTradeId: null,
    notes: [
      candidate.notes,
      "Imported from Robinhood activity CSV.",
      candidate.closeReason === "assigned"
        ? "Assignment P/L includes option premium only; stock P/L is excluded."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    status: candidate.status,
    closeDate: candidate.closeDate ?? undefined,
    stockPriceClose: candidate.stockPriceClose ?? undefined,
    premiumClose: candidate.premiumClose ?? undefined,
    commissionClose: candidate.commissionClose,
    closeReason: candidate.closeReason,
    importSource: "robinhood_csv",
    importFingerprint: candidate.sourceFingerprint,
  };
}

type OptionRight = "put" | "call";
type OpenCode = "STO" | "BTO";
type CloseCode = "STC" | "BTC" | "OEXP" | "OASGN" | "OEXCS";

type ParsedOptionRow = {
  rowIndex: number;
  activityDate: string;
  processDate: string;
  instrument: string;
  description: string;
  transCode: OpenCode | CloseCode;
  contracts: number;
  price: number | null;
  amount: number | null;
  ticker: string;
  expiry: string;
  right: OptionRight;
  strike: number;
};

type LegOpenSlice = {
  rowIndex: number;
  activityDate: string;
  transCode: OpenCode;
  contracts: number;
  price: number;
  amount: number | null;
  description: string;
  strike: number;
};

type SpreadOpenBundle = {
  ticker: string;
  expiry: string;
  openDate: string;
  contracts: number;
  strategy: Strategy;
  shortStrike: number | null;
  longStrike: number | null;
  callShortStrike: number | null;
  callLongStrike: number | null;
  premiumOpen: number;
  commissionOpen: number;
  legs: LegOpenSlice[];
  issues: RobinhoodImportIssue[];
  pairingConfidence: RobinhoodImportConfidence;
};

type OpenPosition = {
  id: number;
  bundle: SpreadOpenBundle;
  remaining: number;
};

type CloseSlice = {
  rowIndex: number;
  activityDate: string;
  transCode: CloseCode;
  contracts: number;
  price: number | null;
  amount: number | null;
  description: string;
  strike: number;
  closeReason: CloseReason;
};

let nextPositionId = 1;

/** RFC 4180 CSV with quoted fields and embedded newlines. */
export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

function parseRobinhoodDate(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = /^\(.+\)$/.test(trimmed);
  const digits = trimmed.replace(/[(),$]/g, "").replace(/,/g, "");
  const num = Number(digits);
  if (!Number.isFinite(num)) return null;
  return negative ? -num : num;
}

function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function parseQuantity(value: string): number {
  const trimmed = value.trim().replace(/S$/i, "");
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function parseStrike(value: string): number | null {
  const num = Number(value.replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

const OPTION_DESC =
  /^(?:Option Expiration for )?([A-Z][A-Z0-9.]{0,9})\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(Put|Call)\s+\$([\d,]+\.\d{2})$/i;

function parseOptionDescription(description: string, instrument: string) {
  const firstLine = description.split(/\r?\n/)[0]?.trim() ?? "";
  const match = firstLine.match(OPTION_DESC);
  if (!match) return null;
  const ticker = match[1].toUpperCase();
  const expiry = parseRobinhoodDate(match[2]);
  const right = match[3].toLowerCase() as OptionRight;
  const strike = parseStrike(match[4]);
  if (!expiry || strike == null) return null;
  if (instrument && instrument.toUpperCase() !== ticker) {
    return { ticker, expiry, right, strike, instrumentMismatch: true as const };
  }
  return { ticker, expiry, right, strike, instrumentMismatch: false as const };
}

function commissionFromFill(
  price: number,
  contracts: number,
  amount: number | null
): number {
  if (amount == null) return 0;
  const gross = Math.abs(price) * contracts * 100;
  const net = Math.abs(amount);
  const fee = Math.abs(gross - net);
  return Number.isFinite(fee) ? Math.max(0, fee) : 0;
}

function eventRef(row: ParsedOptionRow): RobinhoodRawEventRef {
  return {
    rowIndex: row.rowIndex,
    activityDate: row.activityDate,
    transCode: row.transCode,
    description: row.description.split(/\r?\n/)[0] ?? row.description,
  };
}

function hashFingerprint(parts: string[]): string {
  const payload = parts.slice().sort().join("\n");
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return `rh-${(hash >>> 0).toString(16)}`;
}

function buildFingerprint(refs: RobinhoodRawEventRef[], strategy: string, status: string) {
  return hashFingerprint([
    strategy,
    status,
    ...refs.map(
      (r) => `${r.rowIndex}|${r.activityDate}|${r.transCode}|${r.description}`
    ),
  ]);
}

function parseOptionRows(records: string[][]): {
  options: ParsedOptionRow[];
  unsupported: RobinhoodRawEventRef[];
} {
  if (!records.length) return { options: [], unsupported: [] };
  const header = records[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iActivity = idx("activity date");
  const iProcess = idx("process date");
  const iInstrument = idx("instrument");
  const iDescription = idx("description");
  const iTrans = idx("trans code");
  const iQty = idx("quantity");
  const iPrice = idx("price");
  const iAmount = idx("amount");
  if (
    iActivity < 0 ||
    iTrans < 0 ||
    iDescription < 0
  ) {
    return { options: [], unsupported: [] };
  }

  const options: ParsedOptionRow[] = [];
  const unsupported: RobinhoodRawEventRef[] = [];

  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    const transCode = (record[iTrans] ?? "").trim().toUpperCase();
    if (!OPTION_CODES.has(transCode)) continue;

    const activityDate = parseRobinhoodDate(record[iActivity] ?? "");
    const description = record[iDescription] ?? "";
    const instrument = (record[iInstrument] ?? "").trim();
    const contracts = parseQuantity(record[iQty] ?? "");
    const price = parsePrice(record[iPrice] ?? "");
    const amount = parseMoney(record[iAmount] ?? "");

    const ref: RobinhoodRawEventRef = {
      rowIndex: r,
      activityDate: record[iActivity] ?? "",
      transCode,
      description: description.split(/\r?\n/)[0] ?? description,
    };

    const parsed = parseOptionDescription(description, instrument);
    if (!parsed || !activityDate) {
      unsupported.push(ref);
      continue;
    }

    if (parsed.instrumentMismatch) {
      unsupported.push(ref);
      continue;
    }

    if (contracts <= 0 && transCode !== "OEXP" && transCode !== "OASGN" && transCode !== "OEXCS") {
      unsupported.push(ref);
      continue;
    }

    const qty =
      contracts > 0
        ? contracts
        : transCode === "OEXP" || transCode === "OASGN" || transCode === "OEXCS"
          ? 1
          : 0;

    options.push({
      rowIndex: r,
      activityDate,
      processDate: parseRobinhoodDate(record[iProcess] ?? "") ?? activityDate,
      instrument,
      description,
      transCode: transCode as OpenCode | CloseCode,
      contracts: qty,
      price,
      amount,
      ticker: parsed.ticker,
      expiry: parsed.expiry,
      right: parsed.right,
      strike: parsed.strike,
    });
  }

  return { options, unsupported };
}

function verticalStrategy(
  right: OptionRight,
  stoStrike: number,
  btoStrike: number
): Strategy | null {
  if (right === "put") {
    if (stoStrike > btoStrike) return "Put Credit Spread";
    if (stoStrike < btoStrike) return "Put Debit Spread";
    return null;
  }
  if (stoStrike < btoStrike) return "Call Credit Spread";
  if (stoStrike > btoStrike) return "Call Debit Spread";
  return null;
}

function singleStrategy(code: OpenCode, right: OptionRight): Strategy {
  if (code === "STO") return right === "put" ? "Cash-Secured Put" : "Covered Call";
  return right === "put" ? "Long Put" : "Long Call";
}

function netSpreadPremium(
  strategy: Strategy,
  shortPrice: number,
  longPrice: number
): number {
  const net = shortPrice - longPrice;
  return Math.abs(net);
}

function legKey(ticker: string, expiry: string, right: OptionRight, strike: number) {
  return `${ticker}|${expiry}|${right}|${strike}`;
}

function groupOpenKey(ticker: string, expiry: string, right: OptionRight, openDate: string) {
  return `${ticker}|${expiry}|${right}|${openDate}`;
}

function condorGroupKey(ticker: string, expiry: string, openDate: string) {
  return `${ticker}|${expiry}|${openDate}`;
}

type PairingEdge = {
  stoIndex: number;
  btoIndex: number;
  strategy: Strategy;
};

function validPairings(stos: LegOpenSlice[], btos: LegOpenSlice[], right: OptionRight): PairingEdge[] {
  const edges: PairingEdge[] = [];
  for (let si = 0; si < stos.length; si++) {
    for (let bi = 0; bi < btos.length; bi++) {
      if (stos[si].contracts !== btos[bi].contracts) continue;
      const strategy = verticalStrategy(right, stos[si].strike, btos[bi].strike);
      if (!strategy) continue;
      edges.push({ stoIndex: si, btoIndex: bi, strategy });
    }
  }
  return edges;
}

/** Unique perfect matching via backtracking; returns null if ambiguous or incomplete. */
function uniqueSpreadMatching(
  stos: LegOpenSlice[],
  btos: LegOpenSlice[],
  right: OptionRight
): PairingEdge[] | "ambiguous" | null {
  const edges = validPairings(stos, btos, right);
  if (!stos.length || !btos.length) return null;
  if (stos.length !== btos.length) return "ambiguous";

  const solutions: PairingEdge[][] = [];

  function dfs(
    stoUsed: boolean[],
    btoUsed: boolean[],
    chosen: PairingEdge[]
  ) {
    if (chosen.length === stos.length) {
      solutions.push(chosen.slice());
      return;
    }
    if (solutions.length > 1) return;
    const si = stoUsed.findIndex((u) => !u);
    if (si < 0) return;
    for (const edge of edges) {
      if (edge.stoIndex !== si || btoUsed[edge.btoIndex]) continue;
      stoUsed[si] = true;
      btoUsed[edge.btoIndex] = true;
      chosen.push(edge);
      dfs(stoUsed, btoUsed, chosen);
      chosen.pop();
      stoUsed[si] = false;
      btoUsed[edge.btoIndex] = false;
      if (solutions.length > 1) return;
    }
  }

  dfs(Array(stos.length).fill(false), Array(btos.length).fill(false), []);
  if (solutions.length === 1) return solutions[0];
  if (solutions.length > 1) return "ambiguous";
  return "ambiguous";
}

function bundleFromVerticalPair(
  sto: LegOpenSlice,
  bto: LegOpenSlice,
  right: OptionRight,
  strategy: Strategy,
  ticker: string,
  expiry: string,
  confidence: RobinhoodImportConfidence,
  issues: RobinhoodImportIssue[]
): SpreadOpenBundle {
  const shortStrike = sto.strike;
  const longStrike = bto.strike;
  const premiumOpen = netSpreadPremium(strategy, sto.price, bto.price);
  const commissionOpen =
    commissionFromFill(sto.price, sto.contracts, sto.amount) +
    commissionFromFill(bto.price, bto.contracts, bto.amount);

  return {
    ticker,
    expiry,
    openDate: sto.activityDate,
    contracts: sto.contracts,
    strategy,
    shortStrike: right === "put" || strategy.includes("Put") ? shortStrike : shortStrike,
    longStrike: right === "put" || strategy.includes("Put") ? longStrike : longStrike,
    callShortStrike: null,
    callLongStrike: null,
    premiumOpen,
    commissionOpen,
    legs: [sto, bto],
    issues,
    pairingConfidence: confidence,
  };
}

function bundleFromSingle(
  leg: LegOpenSlice,
  right: OptionRight,
  ticker: string,
  expiry: string
): SpreadOpenBundle {
  const strategy = singleStrategy(leg.transCode, right);
  const commissionOpen = commissionFromFill(leg.price, leg.contracts, leg.amount);
  return {
    ticker,
    expiry,
    openDate: leg.activityDate,
    contracts: leg.contracts,
    strategy,
    shortStrike: leg.strike,
    longStrike: null,
    callShortStrike: null,
    callLongStrike: null,
    premiumOpen: leg.price,
    commissionOpen,
    legs: [leg],
    issues: [],
    pairingConfidence: "ready",
  };
}

function buildOpenBundles(openRows: ParsedOptionRow[]): SpreadOpenBundle[] {
  const byGroup = new Map<string, { ticker: string; expiry: string; right: OptionRight; legs: LegOpenSlice[] }>();
  for (const row of openRows) {
    if (row.transCode !== "STO" && row.transCode !== "BTO") continue;
    const leg: LegOpenSlice = {
      rowIndex: row.rowIndex,
      activityDate: row.activityDate,
      transCode: row.transCode as OpenCode,
      contracts: row.contracts,
      price: row.price ?? 0,
      amount: row.amount,
      description: row.description,
      strike: row.strike,
    };
    const key = groupOpenKey(row.ticker, row.expiry, row.right, row.activityDate);
    const bucket = byGroup.get(key) ?? {
      ticker: row.ticker,
      expiry: row.expiry,
      right: row.right,
      legs: [],
    };
    bucket.legs.push(leg);
    byGroup.set(key, bucket);
  }

  const verticalBundles: SpreadOpenBundle[] = [];
  const leftoverSingles: SpreadOpenBundle[] = [];

  for (const { ticker, expiry, right, legs } of byGroup.values()) {
    const stos = legs.filter((l) => l.transCode === "STO");
    const btos = legs.filter((l) => l.transCode === "BTO");
    const matching = uniqueSpreadMatching(stos, btos, right);

    if (matching === "ambiguous") {
      for (const leg of legs) {
        leftoverSingles.push(
          bundleFromSingle(leg, right, ticker, expiry)
        );
      }
      for (const b of leftoverSingles.slice(-legs.length)) {
        b.pairingConfidence = "needs_review";
        b.issues.push({
          code: "ambiguous_vertical_pairing",
          message: `Could not uniquely pair ${stos.length} STO and ${btos.length} BTO legs on ${legs[0]?.activityDate}.`,
          severity: "warning",
        });
      }
      continue;
    }

    if (!matching) {
      for (const sto of stos) {
        leftoverSingles.push(bundleFromSingle(sto, right, ticker, expiry));
      }
      for (const bto of btos) {
        leftoverSingles.push(bundleFromSingle(bto, right, ticker, expiry));
      }
      continue;
    }

    const usedSto = new Set<number>();
    const usedBto = new Set<number>();
    for (const edge of matching) {
      usedSto.add(edge.stoIndex);
      usedBto.add(edge.btoIndex);
      verticalBundles.push(
        bundleFromVerticalPair(
          stos[edge.stoIndex],
          btos[edge.btoIndex],
          right,
          edge.strategy,
          ticker,
          expiry,
          "ready",
          []
        )
      );
    }
    for (let si = 0; si < stos.length; si++) {
      if (!usedSto.has(si)) leftoverSingles.push(bundleFromSingle(stos[si], right, ticker, expiry));
    }
    for (let bi = 0; bi < btos.length; bi++) {
      if (!usedBto.has(bi)) leftoverSingles.push(bundleFromSingle(btos[bi], right, ticker, expiry));
    }
  }

  // Iron condor merge: same ticker, expiry, open date, one put credit + one call credit, same qty.
  const condorCandidates = new Map<string, SpreadOpenBundle[]>();
  const nonCondor: SpreadOpenBundle[] = [];
  for (const bundle of verticalBundles) {
    if (
      bundle.strategy === "Put Credit Spread" ||
      bundle.strategy === "Call Credit Spread"
    ) {
      const key = condorGroupKey(bundle.ticker, bundle.expiry, bundle.openDate);
      const list = condorCandidates.get(key) ?? [];
      list.push(bundle);
      condorCandidates.set(key, list);
    } else {
      nonCondor.push(bundle);
    }
  }

  const merged: SpreadOpenBundle[] = [...nonCondor];
  for (const list of condorCandidates.values()) {
    const puts = list.filter((b) => b.strategy === "Put Credit Spread");
    const calls = list.filter((b) => b.strategy === "Call Credit Spread");
    if (puts.length === 1 && calls.length === 1 && puts[0].contracts === calls[0].contracts) {
      const put = puts[0];
      const call = calls[0];
      merged.push({
        ticker: put.ticker,
        expiry: put.expiry,
        openDate: put.openDate,
        contracts: put.contracts,
        strategy: "Iron Condor",
        shortStrike: put.shortStrike,
        longStrike: put.longStrike,
        callShortStrike: call.shortStrike,
        callLongStrike: call.longStrike,
        premiumOpen: put.premiumOpen + call.premiumOpen,
        commissionOpen: put.commissionOpen + call.commissionOpen,
        legs: [...put.legs, ...call.legs],
        issues: [],
        pairingConfidence: "ready",
      });
    } else {
      merged.push(...list);
    }
  }

  return [...merged, ...leftoverSingles];
}

function positionLegKeys(bundle: SpreadOpenBundle): string[] {
  if (bundle.strategy === "Iron Condor") {
    return [
      legKey(bundle.ticker, bundle.expiry, "put", bundle.shortStrike!),
      legKey(bundle.ticker, bundle.expiry, "put", bundle.longStrike!),
      legKey(bundle.ticker, bundle.expiry, "call", bundle.callShortStrike!),
      legKey(bundle.ticker, bundle.expiry, "call", bundle.callLongStrike!),
    ];
  }
  const right: OptionRight = bundle.strategy.toLowerCase().includes("call") ? "call" : "put";
  if (bundle.longStrike != null && bundle.strategy.includes("Spread")) {
    return [
      legKey(bundle.ticker, bundle.expiry, right, bundle.shortStrike!),
      legKey(bundle.ticker, bundle.expiry, right, bundle.longStrike),
    ];
  }
  return [legKey(bundle.ticker, bundle.expiry, right, bundle.shortStrike!)];
}

function closeReasonForCode(code: CloseCode): CloseReason {
  if (code === "OEXP") return "expired";
  if (code === "OASGN" || code === "OEXCS") return "assigned";
  return "closed";
}

type PendingCloseLeg = CloseSlice & {
  ticker: string;
  expiry: string;
  right: OptionRight;
};

function matchCloseToPositions(
  positions: OpenPosition[],
  close: CloseSlice,
  ticker: string,
  expiry: string,
  right: OptionRight
): OpenPosition[] {
  const key = legKey(ticker, expiry, right, close.strike);
  return positions.filter((p) => {
    if (p.remaining <= 0) return false;
    return positionLegKeys(p.bundle).includes(key);
  });
}

type CandidateBase = Omit<
  RobinhoodTradeCandidate,
  | "sourceFingerprint"
  | "confidence"
  | "status"
  | "closeDate"
  | "premiumClose"
  | "commissionClose"
  | "closeReason"
  | "stockPriceClose"
>;

function candidateShell(bundle: SpreadOpenBundle): CandidateBase {
  return {
    issues: [...bundle.issues],
    rawEventRefs: bundle.legs.map((l) => ({
      rowIndex: l.rowIndex,
      activityDate: l.activityDate,
      transCode: l.transCode,
      description: l.description.split(/\r?\n/)[0] ?? l.description,
    })),
    ticker: bundle.ticker,
    strategy: bundle.strategy,
    contracts: bundle.contracts,
    expiry: bundle.expiry,
    openDate: bundle.openDate,
    shortStrike: bundle.shortStrike,
    longStrike: bundle.longStrike,
    callShortStrike: bundle.callShortStrike,
    callLongStrike: bundle.callLongStrike,
    stockPriceOpen: 0,
    iv: 0,
    delta: 0,
    sigma: 0,
    theta: 0,
    premiumOpen: bundle.premiumOpen,
    commissionOpen: bundle.commissionOpen,
    notes: "",
  };
}

function inferStrategyFromCloseLeg(
  transCode: CloseCode,
  right: OptionRight
): Strategy {
  const closingShort =
    transCode === "BTC" ||
    transCode === "OEXP" ||
    transCode === "OASGN" ||
    transCode === "OEXCS";
  if (closingShort) {
    return right === "put" ? "Cash-Secured Put" : "Covered Call";
  }
  return right === "put" ? "Long Put" : "Long Call";
}

function findSpreadPairIndex(
  leg: PendingCloseLeg,
  legs: PendingCloseLeg[],
  used: Set<number>,
  pos: OpenPosition,
  right: OptionRight,
  qty: number
): number {
  const shortStrike = pos.bundle.shortStrike!;
  const longStrike = pos.bundle.longStrike!;
  const wantStrike = leg.strike === shortStrike ? longStrike : shortStrike;
  for (let j = 0; j < legs.length; j++) {
    if (used.has(j)) continue;
    const other = legs[j];
    if (
      other.ticker === leg.ticker &&
      other.expiry === leg.expiry &&
      other.right === right &&
      other.strike === wantStrike &&
      other.contracts >= qty
    ) {
      return j;
    }
  }
  return -1;
}

function emitClosed(
  candidates: RobinhoodTradeCandidate[],
  base: CandidateBase,
  closeDate: string,
  premiumClose: number,
  commissionClose: number,
  closeReason: CloseReason,
  closeRefs: RobinhoodRawEventRef[],
  confidence: RobinhoodImportConfidence
) {
  candidates.push(
    finalizeCandidate(
      base,
      "closed",
      closeDate,
      premiumClose,
      commissionClose,
      closeReason,
      closeRefs,
      confidence
    )
  );
}

function splitOpenPosition(
  positions: OpenPosition[],
  pos: OpenPosition,
  closedQty: number
) {
  if (pos.remaining <= closedQty) {
    pos.remaining = 0;
    return;
  }
  const remainder = pos.remaining - closedQty;
  pos.remaining = 0;
  positions.push({
    id: nextPositionId++,
    bundle: { ...pos.bundle, contracts: remainder },
    remaining: remainder,
  });
}

function collapseOpenSingles(
  candidates: RobinhoodTradeCandidate[]
): RobinhoodTradeCandidate[] {
  const closed = candidates.filter((c) => c.status === "closed");
  const open = candidates.filter((c) => c.status === "open");
  const merged = new Map<string, RobinhoodTradeCandidate>();

  for (const c of open) {
    const key = `${c.ticker}|${c.strategy}|${c.expiry}|${c.shortStrike}|${c.longStrike}|${c.callShortStrike}|${c.callLongStrike}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...c });
      continue;
    }
    const total = existing.contracts + c.contracts;
    const wOpen =
      (existing.premiumOpen * existing.contracts + c.premiumOpen * c.contracts) /
      total;
    existing.contracts = total;
    existing.premiumOpen = wOpen;
    existing.commissionOpen += c.commissionOpen;
    existing.rawEventRefs = [...existing.rawEventRefs, ...c.rawEventRefs];
    existing.openDate =
      existing.openDate < c.openDate ? existing.openDate : c.openDate;
    existing.sourceFingerprint = buildFingerprint(
      existing.rawEventRefs,
      String(existing.strategy),
      "open"
    );
    existing.issues = [...existing.issues, ...c.issues];
    if (c.confidence === "needs_review") existing.confidence = "needs_review";
  }

  return [...closed, ...merged.values()];
}

function flagStaleOpens(
  candidates: RobinhoodTradeCandidate[],
  asOfIso = "2026-09-19"
): RobinhoodTradeCandidate[] {
  return candidates.map((c) => {
    if (c.status !== "open" || c.expiry >= asOfIso) return c;
    return {
      ...c,
      confidence: "needs_review",
      issues: [
        ...c.issues,
        {
          code: "stale_open_lot",
          message: `Expiry ${c.expiry} is before as-of ${asOfIso}; book may not reconcile.`,
          severity: "warning",
        },
      ],
    };
  });
}

function finalizeCandidate(
  base: ReturnType<typeof candidateShell>,
  status: "open" | "closed",
  closeDate: string | null,
  premiumClose: number | null,
  commissionClose: number | undefined,
  closeReason: CloseReason | undefined,
  extraRefs: RobinhoodRawEventRef[],
  confidence: RobinhoodImportConfidence
): RobinhoodTradeCandidate {
  const refs = [...base.rawEventRefs, ...extraRefs];
  const confidenceRank = (c: RobinhoodImportConfidence) =>
    c === "unsupported" ? 2 : c === "needs_review" ? 1 : 0;
  let conf = confidence;
  if (base.issues.some((i) => i.severity === "error")) conf = "unsupported";
  else if (confidenceRank(conf) < confidenceRank("needs_review") && base.issues.length) {
    conf = "needs_review";
  }
  return {
    ...base,
    sourceFingerprint: buildFingerprint(refs, String(base.strategy), status),
    confidence: conf,
    status,
    closeDate,
    premiumClose,
    commissionClose,
    closeReason,
    stockPriceClose: status === "closed" ? 0 : null,
    rawEventRefs: refs,
  };
}

function reconstructTrades(
  openRows: ParsedOptionRow[],
  allEvents: ParsedOptionRow[],
  asOfIso?: string
): RobinhoodTradeCandidate[] {
  const bundles = buildOpenBundles(openRows);

  const positions: OpenPosition[] = bundles.map((bundle) => ({
    id: nextPositionId++,
    bundle,
    remaining: bundle.contracts,
  }));

  positions.sort(
    (a, b) =>
      Math.min(...a.bundle.legs.map((l) => l.rowIndex)) -
      Math.min(...b.bundle.legs.map((l) => l.rowIndex))
  );

  const candidates: RobinhoodTradeCandidate[] = [];
  const closes = allEvents
    .filter(
      (r) =>
        r.transCode === "STC" ||
        r.transCode === "BTC" ||
        r.transCode === "OEXP" ||
        r.transCode === "OASGN" ||
        r.transCode === "OEXCS"
    )
    .sort((a, b) =>
      a.activityDate === b.activityDate
        ? a.rowIndex - b.rowIndex
        : a.activityDate.localeCompare(b.activityDate)
    );

  const pendingByDay = new Map<string, PendingCloseLeg[]>();

  function closeRef(leg: CloseSlice): RobinhoodRawEventRef {
    return {
      rowIndex: leg.rowIndex,
      activityDate: leg.activityDate,
      transCode: leg.transCode,
      description: leg.description.split(/\r?\n/)[0] ?? leg.description,
    };
  }

  function fifoPositionsForLeg(leg: PendingCloseLeg) {
    return matchCloseToPositions(
      positions.filter((p) => p.remaining > 0),
      leg,
      leg.ticker,
      leg.expiry,
      leg.right
    );
  }

  function flushDayCloses(date: string) {
    const legs: PendingCloseLeg[] = pendingByDay.get(date) ?? [];
    pendingByDay.delete(date);
    if (!legs.length) return;

    const used = new Set<number>();

    for (let i = 0; i < legs.length; i++) {
      if (used.has(i)) continue;
      let leg = legs[i];
      let qtyLeft = leg.contracts;

      while (qtyLeft > 0) {
        const openPositions = fifoPositionsForLeg(leg);
        if (!openPositions.length) {
          const orphanBase: CandidateBase = {
            issues: [
              {
                code: "orphan_close",
                message: `Close without matching open: ${leg.description.split(/\r?\n/)[0]}`,
                severity: "warning",
              },
            ],
            rawEventRefs: [],
            ticker: leg.ticker,
            strategy: inferStrategyFromCloseLeg(leg.transCode, leg.right),
            contracts: qtyLeft,
            expiry: leg.expiry,
            openDate: leg.activityDate,
            shortStrike: leg.strike,
            longStrike: null,
            callShortStrike: null,
            callLongStrike: null,
            stockPriceOpen: 0,
            iv: 0,
            delta: 0,
            sigma: 0,
            theta: 0,
            premiumOpen: 0,
            commissionOpen: 0,
            notes: "Orphan close — opening activity missing or already consumed.",
          };
          emitClosed(
            candidates,
            orphanBase,
            leg.activityDate,
            leg.price ?? 0,
            leg.price != null
              ? commissionFromFill(leg.price, qtyLeft, leg.amount)
              : 0,
            closeReasonForCode(leg.transCode),
            [closeRef(leg)],
            "needs_review"
          );
          qtyLeft = 0;
          break;
        }

        const pos = openPositions[0];
        const take = Math.min(qtyLeft, pos.remaining);
        const closeReason = closeReasonForCode(leg.transCode);
        const closeRefs = [closeRef(leg)];

        let premiumClose = 0;
        let commissionClose = 0;
        let confidence = pos.bundle.pairingConfidence;

        const isVertical =
          pos.bundle.longStrike != null &&
          String(pos.bundle.strategy).includes("Spread") &&
          pos.bundle.strategy !== "Iron Condor";

        if (isVertical) {
          const right: OptionRight = pos.bundle.strategy.toLowerCase().includes("call")
            ? "call"
            : "put";
          const pairedIndex = findSpreadPairIndex(leg, legs, used, pos, right, take);
          const terminal =
            closeReason === "expired" ||
            closeReason === "assigned" ||
            leg.transCode === "OEXP" ||
            leg.transCode === "OASGN" ||
            leg.transCode === "OEXCS";

          if (pairedIndex < 0 && !terminal) {
            pos.bundle.issues.push({
              code: "partial_spread_close",
              message:
                "Vertical spread leg closed without same-day paired leg; left open for review.",
              severity: "warning",
            });
            pos.bundle.pairingConfidence = "needs_review";
            confidence = "needs_review";
            qtyLeft = 0;
            used.add(i);
            break;
          }

          if (pairedIndex >= 0) {
            const other = legs[pairedIndex];
            used.add(pairedIndex);
            closeRefs.push(closeRef(other));
            const shortLeg = pos.bundle.legs.find((l) => l.transCode === "STO")!;
            const shortClose =
              leg.strike === shortLeg.strike
                ? leg
                : other.strike === shortLeg.strike
                  ? other
                  : leg.transCode === "BTC"
                    ? leg
                    : other;
            const longClose = shortClose === leg ? other : leg;
            const shortPx = shortClose.price ?? 0;
            const longPx = longClose.price ?? 0;
            if (terminal) {
              premiumClose = 0;
            } else {
              premiumClose = netSpreadPremium(
                pos.bundle.strategy as Strategy,
                shortPx,
                longPx
              );
              commissionClose =
                commissionFromFill(shortPx, take, shortClose.amount) +
                commissionFromFill(longPx, take, longClose.amount);
            }
          } else {
            premiumClose = 0;
          }
        } else if (pos.bundle.strategy === "Iron Condor") {
          pos.bundle.issues.push({
            code: "partial_condor_close",
            message: "Iron condor leg closed individually; full condor close not inferred.",
            severity: "warning",
          });
          confidence = "needs_review";
          premiumClose =
            closeReason === "expired" || closeReason === "assigned"
              ? 0
              : leg.price ?? 0;
          commissionClose = commissionFromFill(
            leg.price ?? 0,
            take,
            leg.amount
          );
        } else {
          premiumClose =
            closeReason === "expired" || closeReason === "assigned"
              ? 0
              : leg.price ?? 0;
          commissionClose = commissionFromFill(
            leg.price ?? 0,
            take,
            leg.amount
          );
        }

        emitClosed(
          candidates,
          candidateShell({ ...pos.bundle, contracts: take }),
          leg.activityDate,
          premiumClose,
          commissionClose,
          closeReason,
          closeRefs,
          confidence
        );

        splitOpenPosition(positions, pos, take);
        qtyLeft -= take;
        if (qtyLeft <= 0) used.add(i);
      }
    }
  }

  const closeDates = [...new Set(closes.map((c) => c.activityDate))].sort();
  for (const row of closes) {
    const slice: PendingCloseLeg = {
      rowIndex: row.rowIndex,
      activityDate: row.activityDate,
      transCode: row.transCode as CloseCode,
      contracts: row.contracts,
      price: row.price,
      amount: row.amount,
      description: row.description,
      strike: row.strike,
      closeReason: closeReasonForCode(row.transCode as CloseCode),
      ticker: row.ticker,
      expiry: row.expiry,
      right: row.right,
    };
    const list = pendingByDay.get(row.activityDate) ?? [];
    list.push(slice);
    pendingByDay.set(row.activityDate, list);
  }
  for (const date of closeDates) flushDayCloses(date);

  for (const pos of positions) {
    if (pos.remaining <= 0) continue;
    candidates.push(
      finalizeCandidate(
        candidateShell({ ...pos.bundle, contracts: pos.remaining }),
        "open",
        null,
        null,
        undefined,
        undefined,
        [],
        pos.bundle.pairingConfidence
      )
    );
  }

  return flagStaleOpens(collapseOpenSingles(candidates), asOfIso);
}

export function summarizeRobinhoodCandidates(
  candidates: RobinhoodTradeCandidate[]
): RobinhoodImportSummary {
  const byStrategy: Record<string, number> = {};
  const monthlyRealizedPnl: Record<string, number> = {};
  let openCount = 0;
  let closedCount = 0;
  let readyCount = 0;
  let needsReviewCount = 0;
  let unsupportedCount = 0;

  for (const c of candidates) {
    byStrategy[c.strategy] = (byStrategy[c.strategy] ?? 0) + 1;
    if (c.status === "open") openCount++;
    else closedCount++;
    if (c.confidence === "ready") readyCount++;
    else if (c.confidence === "needs_review") needsReviewCount++;
    else unsupportedCount++;

    if (c.status === "closed" && c.closeDate && c.premiumClose != null) {
      const pnl = realizedPnl(
        c.premiumOpen,
        c.premiumClose,
        c.contracts,
        c.strategy,
        {
          commissionOpen: c.commissionOpen,
          commissionClose: c.commissionClose,
        }
      );
      const mk = monthKey(c.closeDate);
      monthlyRealizedPnl[mk] = (monthlyRealizedPnl[mk] ?? 0) + pnl;
    }
  }

  return {
    totalCandidates: candidates.length,
    openCount,
    closedCount,
    readyCount,
    needsReviewCount,
    unsupportedCount,
    byStrategy,
    monthlyRealizedPnl,
  };
}

export function parseRobinhoodCsv(text: string): RobinhoodParseResult {
  nextPositionId = 1;
  const records = parseCsvRecords(text);
  const { options, unsupported } = parseOptionRows(records);
  const opens = options.filter((o) => o.transCode === "STO" || o.transCode === "BTO");
  const asOf =
    options.reduce(
      (max, row) => (row.activityDate > max ? row.activityDate : max),
      ""
    ) || undefined;
  const candidates = reconstructTrades(opens, options, asOf);
  const summary = summarizeRobinhoodCandidates(candidates);
  return { candidates, unsupportedRows: unsupported, summary };
}
