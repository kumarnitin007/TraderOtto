import { kindGroups, kindMeta, tagPalette } from "@/lib/vaultItemTypes";
import type { VaultItem, VaultKind, VaultTag } from "@/lib/vaultRepository";

export const VAULT_CSV_HEADERS = [
  "id",
  "kind",
  "name",
  "username",
  "password",
  "website",
  "note",
  "tags",
  "favorite",
  "color",
  "created_at",
  "updated_at",
] as const;

const VAULT_KIND_SET = new Set<VaultKind>(
  kindGroups.flatMap((group) => group.kinds.map((kind) => kind.value))
);

type CanonicalField =
  | "id"
  | "kind"
  | "name"
  | "username"
  | "password"
  | "website"
  | "note"
  | "tags"
  | "favorite"
  | "color"
  | "createdAt"
  | "updatedAt"
  | "deletedAt";

const HEADER_ALIASES: Record<string, CanonicalField> = {
  id: "id",
  kind: "kind",
  type: "kind",
  category: "kind",
  name: "name",
  title: "name",
  username: "username",
  "username/email": "username",
  username_email: "username",
  email: "username",
  password: "password",
  website: "website",
  url: "website",
  note: "note",
  notes: "note",
  tags: "tags",
  favorite: "favorite",
  colour: "color",
  color: "color",
  created: "createdAt",
  created_at: "createdAt",
  createdat: "createdAt",
  "created at": "createdAt",
  updated: "updatedAt",
  updated_at: "updatedAt",
  updatedat: "updatedAt",
  deleted_at: "deletedAt",
  deletedat: "deletedAt",
};

const JOURNAL_MARKERS = new Set([
  "ticker",
  "strategy",
  "premium_open",
  "premium_close",
  "contracts",
  "open_date",
  "close_date",
]);

const FIELD_LABELS: Record<string, string> = {
  kind: "Category",
  name: "Name",
  username: "Username",
  password: "Password",
  website: "Website",
  note: "Note",
  tags: "Tags",
  favorite: "Favorite",
  color: "Color",
  createdAt: "Created",
  updatedAt: "Updated",
  deletedAt: "Deleted",
  customFields: "Custom fields",
};

export type VaultExportScope =
  | { mode: "all" }
  | { mode: "kind"; kind: VaultKind }
  | { mode: "tag"; tagId: string };

export interface VaultCsvIssue {
  row?: number;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export type VaultCsvRowAction = "create" | "update" | "duplicate";
export type VaultCsvMatchBy = "id" | "name_username";

export interface VaultCsvImportRowMeta {
  row: number;
  action: VaultCsvRowAction;
  matchBy?: VaultCsvMatchBy;
  changedFields: string[];
  /** Non-standard CSV columns with values applied to this row (incl. merged custom on update). */
  customFields: Record<string, string>;
}

export interface VaultCsvImportPreview {
  items: VaultItem[];
  rows: VaultCsvImportRowMeta[];
  newTags: VaultTag[];
  issues: VaultCsvIssue[];
  stats: {
    dataRows: number;
    importable: number;
    creates: number;
    updates: number;
    duplicates: number;
    skipped: number;
  };
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeMatchText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

function nameUsernameKey(name: string, username: string | undefined): string {
  return `${normalizeMatchText(name)}\0${normalizeMatchText(username ?? "")}`;
}

function escapeCsvField(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180-style CSV parser (commas, quotes, embedded newlines). */
export function parseCsvRecords(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let index = 0;
  let inQuotes = false;

  while (index < input.length) {
    const char = input[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      index += 1;
      continue;
    }
    if (char === "\r") {
      if (input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  if (inQuotes) {
    row.push(field);
    rows.push(row);
  } else if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ""));
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const value = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(value)) return true;
  if (["false", "0", "no", "n"].includes(value)) return false;
  return undefined;
}

function normalizeKindInput(raw: string): string {
  let value = raw
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[_./\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (value.endsWith("ies")) {
    value = `${value.slice(0, -3)}y`;
  } else if (value.endsWith("s") && !value.endsWith("ss") && value.length > 3) {
    value = value.slice(0, -1);
  }
  return value;
}

const KIND_ALIASES: Map<string, VaultKind> = new Map([
  ["password", "login"],
  ["login", "login"],
  ["log in", "login"],
  ["account", "login"],
  ["web login", "login"],
  ["secure note", "note"],
  ["note", "note"],
  ["notes", "note"],
  ["contact", "contact"],
  ["contact info", "contact"],
  ["credit card", "card"],
  ["debit card", "card"],
  ["payment card", "card"],
  ["card", "card"],
  ["bank account", "bank"],
  ["bank", "bank"],
  ["drivers license", "license"],
  ["driver license", "license"],
  ["driving license", "license"],
  ["license", "license"],
  ["passport", "passport"],
  ["social security", "ssn"],
  ["social security number", "ssn"],
  ["ssn", "ssn"],
  ["health insurance", "health"],
  ["health", "health"],
  ["insurance policy", "insurance"],
  ["insurance", "insurance"],
  ["membership card", "membership"],
  ["membership", "membership"],
  ["wi fi", "wifi"],
  ["wifi", "wifi"],
  ["wireless", "wifi"],
  ["email account", "email"],
  ["email", "email"],
  ["instant messenger", "messenger"],
  ["messenger", "messenger"],
  ["im", "messenger"],
  ["database", "database"],
  ["db", "database"],
  ["server", "server"],
  ["ssh", "ssh"],
  ["ssh key", "ssh"],
  ["software license", "software"],
  ["software", "software"],
  ["license key", "software"],
]);

function parseKind(raw: string | undefined): { kind: VaultKind; warning?: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { kind: "login" };

  const exact = trimmed.toLowerCase();
  if (VAULT_KIND_SET.has(exact as VaultKind)) {
    return { kind: exact as VaultKind };
  }

  const normalized = normalizeKindInput(trimmed);
  if (VAULT_KIND_SET.has(normalized as VaultKind)) {
    if (normalized !== exact) {
      return {
        kind: normalized as VaultKind,
        warning: `Category "${trimmed}" mapped to ${normalized}.`,
      };
    }
    return { kind: normalized as VaultKind };
  }

  const alias = KIND_ALIASES.get(normalized);
  if (alias) {
    return {
      kind: alias,
      warning: `Category "${trimmed}" mapped to ${alias}.`,
    };
  }

  const aliasByLength = [...KIND_ALIASES.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [pattern, kind] of aliasByLength) {
    if (normalized.includes(pattern)) {
      return {
        kind,
        warning: `Category "${trimmed}" mapped to ${kind}.`,
      };
    }
  }

  return {
    kind: "login",
    warning: `Unknown category "${trimmed}" — using login.`,
  };
}

export function splitTagNames(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tagNameById(tags: VaultTag[]): Map<string, string> {
  return new Map(tags.map((tag) => [tag.id, tag.name]));
}

function collectCustomFieldKeys(items: VaultItem[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.customFields) {
      for (const key of Object.keys(item.customFields)) keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function filterItemsForExport(
  items: VaultItem[],
  scope: VaultExportScope
): VaultItem[] {
  const active = items.filter((item) => !item.deletedAt);
  switch (scope.mode) {
    case "all":
      return active;
    case "kind":
      return active.filter((item) => item.kind === scope.kind);
    case "tag":
      return active.filter((item) => item.tags.includes(scope.tagId));
  }
}

export function vaultItemsToCsv(items: VaultItem[], tags: VaultTag[]): string {
  const names = tagNameById(tags);
  const customKeys = collectCustomFieldKeys(items);
  const includeDeletedAt = items.some((item) => item.deletedAt);
  const headers = [
    ...VAULT_CSV_HEADERS,
    ...(includeDeletedAt ? (["deleted_at"] as const) : []),
    ...customKeys,
  ];
  const lines = [headers.join(",")];
  for (const item of items) {
    const tagCell = item.tags
      .map((id) => names.get(id))
      .filter((name): name is string => Boolean(name))
      .join(";");
    const standard = [
      item.id,
      item.kind,
      item.name,
      item.username ?? "",
      item.password ?? "",
      item.website ?? "",
      item.note ?? "",
      tagCell,
      item.favorite ? "true" : "false",
      item.color,
      item.createdAt ?? "",
      item.updatedAt,
    ];
    const deletedCell = includeDeletedAt ? [item.deletedAt ?? ""] : [];
    const customCells = customKeys.map((key) => item.customFields?.[key] ?? "");
    lines.push(
      [...standard, ...deletedCell, ...customCells].map(escapeCsvField).join(",")
    );
  }
  return lines.join("\r\n");
}

export function downloadVaultCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isTraderJournalCsv(normalizedHeaders: string[]): boolean {
  const headerSet = new Set(normalizedHeaders);
  const looksLikeJournal =
    headerSet.has("ticker") &&
    headerSet.has("strategy") &&
    (headerSet.has("premium_open") || headerSet.has("open_date"));
  if (!looksLikeJournal) return false;

  const vaultMarkers = ["kind", "type", "category", "password", "username", "website", "url"];
  const hasVaultMarker = vaultMarkers.some((marker) => headerSet.has(marker));
  return !hasVaultMarker;
}

function mapHeaders(rawHeaders: string[]): {
  fields: (CanonicalField | null)[];
  extraColumns: { colIndex: number; header: string }[];
  issues: VaultCsvIssue[];
} {
  const issues: VaultCsvIssue[] = [];
  const extraColumns: { colIndex: number; header: string }[] = [];
  const fields = rawHeaders.map((header, colIndex) => {
    const normalized = normalizeHeader(header);
    const mapped = HEADER_ALIASES[normalized];
    if (!mapped && normalized !== "") {
      extraColumns.push({ colIndex, header: header.trim() || header });
      issues.push({
        field: header,
        message: `Column "${header}" will be imported as an additional field.`,
        severity: "warning",
      });
    }
    return mapped ?? null;
  });
  return { fields, extraColumns, issues };
}

function resolveTagsForImport(
  raw: string,
  tagByLowerName: Map<string, VaultTag>,
  newTags: VaultTag[],
  paletteOffset: number
): { tagIds: string[]; paletteOffset: number; warnings: VaultCsvIssue[] } {
  const warnings: VaultCsvIssue[] = [];
  const tagIds: string[] = [];
  let offset = paletteOffset;

  for (const name of splitTagNames(raw)) {
    const key = name.toLowerCase();
    let tag = tagByLowerName.get(key);
    if (!tag) {
      tag = {
        id: crypto.randomUUID(),
        name,
        color: tagPalette[offset % tagPalette.length]!,
      };
      offset += 1;
      newTags.push(tag);
      tagByLowerName.set(key, tag);
      warnings.push({
        message: `Created tag "${name}".`,
        severity: "warning",
      });
    }
    tagIds.push(tag.id);
  }

  return { tagIds, paletteOffset: offset, warnings };
}

function optionalString(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? "").trim();
  return trimmed || undefined;
}

function tagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

function customFieldsEqual(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined
): boolean {
  const keysA = Object.keys(a ?? {}).sort();
  const keysB = Object.keys(b ?? {}).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key, index) => key === keysB[index] && (a ?? {})[key] === (b ?? {})[key]);
}

function computeChangedFields(before: VaultItem | undefined, after: VaultItem): string[] {
  if (!before) return [];
  const changed: string[] = [];
  const scalarFields: (keyof VaultItem)[] = [
    "kind",
    "name",
    "username",
    "password",
    "website",
    "note",
    "favorite",
    "color",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ];
  for (const field of scalarFields) {
    const prev = before[field];
    const next = after[field];
    if (prev !== next) {
      changed.push(FIELD_LABELS[field] ?? field);
    }
  }
  if (!tagsEqual(before.tags, after.tags)) {
    changed.push(FIELD_LABELS.tags!);
  }
  if (!customFieldsEqual(before.customFields, after.customFields)) {
    const beforeKeys = new Set(Object.keys(before.customFields ?? {}));
    const afterKeys = new Set(Object.keys(after.customFields ?? {}));
    for (const key of afterKeys) {
      if (!beforeKeys.has(key) || before.customFields?.[key] !== after.customFields?.[key]) {
        changed.push(key);
      }
    }
    for (const key of beforeKeys) {
      if (!afterKeys.has(key)) {
        changed.push(key);
      }
    }
  }
  return [...new Set(changed)];
}

function extractCustomFieldsFromRow(
  cells: string[],
  extraColumns: { colIndex: number; header: string }[]
): Record<string, string> {
  const custom: Record<string, string> = {};
  for (const { colIndex, header } of extraColumns) {
    const value = (cells[colIndex] ?? "").trim();
    if (value) custom[header] = value;
  }
  return custom;
}

function resolveExistingItem(
  rawId: string,
  name: string,
  username: string | undefined,
  existingById: Map<string, VaultItem>,
  existingByNameUser: Map<string, VaultItem>
): { existing?: VaultItem; matchBy?: VaultCsvMatchBy; id: string } {
  if (rawId && existingById.has(rawId)) {
    return { existing: existingById.get(rawId), matchBy: "id", id: rawId };
  }

  const csvUsername = username ?? "";
  const match = existingByNameUser.get(nameUsernameKey(name, csvUsername));
  if (match) {
    if (csvUsername === "" && (match.username ?? "").trim() !== "") {
      // Do not name-only match against a non-blank existing username.
    } else {
      return { existing: match, matchBy: "name_username", id: match.id };
    }
  }

  return { id: rawId || crypto.randomUUID() };
}

export function parseVaultCsv(
  csvText: string,
  existingItems: VaultItem[],
  existingTags: VaultTag[]
): VaultCsvImportPreview {
  const issues: VaultCsvIssue[] = [];
  const rows = parseCsvRecords(csvText);

  if (!rows.length) {
    return {
      items: [],
      rows: [],
      newTags: [],
      issues: [{ message: "The file is empty.", severity: "error" }],
      stats: { dataRows: 0, importable: 0, creates: 0, updates: 0, duplicates: 0, skipped: 0 },
    };
  }

  const [headerRow, ...dataRows] = rows;
  const normalizedHeaders = headerRow!.map(normalizeHeader);

  if (isTraderJournalCsv(normalizedHeaders)) {
    return {
      items: [],
      rows: [],
      newTags: [],
      issues: [
        {
          message:
            "This looks like a Trader Otto journal export (ticker, strategy, …). Vault import expects vault columns such as kind, name, and password.",
          severity: "error",
        },
      ],
      stats: { dataRows: 0, importable: 0, creates: 0, updates: 0, duplicates: 0, skipped: 0 },
    };
  }

  const { fields: columnMap, extraColumns, issues: headerIssues } = mapHeaders(headerRow!);
  issues.push(...headerIssues);

  const hasNameColumn = columnMap.includes("name");
  const vaultColumnHits = columnMap.filter(Boolean).length;
  const journalOnly = normalizedHeaders.filter((h) => JOURNAL_MARKERS.has(h)).length;

  if (!hasNameColumn || vaultColumnHits < 2) {
    issues.push({
      message:
        "Missing required vault columns. Include at least name plus other vault fields (kind, username, password, …).",
      severity: "error",
    });
    if (journalOnly >= 2) {
      issues.push({
        message: "Trader journal CSV files cannot be imported into the vault.",
        severity: "error",
      });
    }
    return {
      items: [],
      rows: [],
      newTags: [],
      issues,
      stats: {
        dataRows: dataRows.length,
        importable: 0,
        creates: 0,
        updates: 0,
        duplicates: 0,
        skipped: dataRows.length,
      },
    };
  }

  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const existingByNameUser = new Map<string, VaultItem>();
  for (const item of existingItems) {
    const legacyUsername = item.customFields?.["Username/Email"];
    existingByNameUser.set(
      nameUsernameKey(item.name, item.username ?? legacyUsername),
      item
    );
  }

  const tagByLowerName = new Map(
    existingTags.map((tag) => [tag.name.toLowerCase(), tag])
  );
  const newTags: VaultTag[] = [];
  let paletteOffset = existingTags.length + newTags.length;

  const items: VaultItem[] = [];
  const rowMeta: VaultCsvImportRowMeta[] = [];
  let creates = 0;
  let updates = 0;
  let duplicates = 0;
  let skipped = 0;

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const record: Partial<Record<CanonicalField, string>> = {};

    columnMap.forEach((field, colIndex) => {
      if (!field) return;
      record[field] = cells[colIndex] ?? "";
    });

    const name = (record.name ?? "").trim();
    if (!name) {
      issues.push({
        row: rowNumber,
        field: "name",
        message: "Name is required; row skipped.",
        severity: "error",
      });
      skipped += 1;
      return;
    }

    const rawId = (record.id ?? "").trim();
    const csvUsername = optionalString(record.username);
    const { existing, matchBy, id } = resolveExistingItem(
      rawId,
      name,
      csvUsername,
      existingById,
      existingByNameUser
    );

    const { kind, warning: kindWarning } = columnMap.includes("kind")
      ? parseKind(record.kind)
      : { kind: existing?.kind ?? ("login" as VaultKind) };
    if (kindWarning) {
      issues.push({ row: rowNumber, field: "kind", message: kindWarning, severity: "warning" });
    }

    const favoriteParsed = parseBoolean(record.favorite);
    if (record.favorite?.trim() && favoriteParsed === undefined) {
      issues.push({
        row: rowNumber,
        field: "favorite",
        message: `Could not parse favorite "${record.favorite}"; using false.`,
        severity: "warning",
      });
    }

    const { tagIds, paletteOffset: nextOffset, warnings: tagWarnings } = resolveTagsForImport(
      record.tags ?? "",
      tagByLowerName,
      newTags,
      paletteOffset
    );
    paletteOffset = nextOffset;
    issues.push(...tagWarnings.map((issue) => ({ ...issue, row: rowNumber })));

    const customFromCsv = extractCustomFieldsFromRow(cells, extraColumns);
    const mergedCustomFields =
      Object.keys(customFromCsv).length > 0 || existing?.customFields
        ? { ...(existing?.customFields ?? {}), ...customFromCsv }
        : undefined;
    const customFieldsPreview = customFromCsv;

    const meta = kindMeta(kind);
    const color = (record.color ?? "").trim() || existing?.color || meta.color;
    const updatedAt =
      (record.updatedAt ?? "").trim() || new Date().toISOString();
    const hasDeletedColumn = columnMap.includes("deletedAt");

    const item: VaultItem = {
      id,
      kind,
      name,
      username: columnMap.includes("username")
        ? optionalString(record.username)
        : existing?.username,
      password: columnMap.includes("password")
        ? optionalString(record.password)
        : existing?.password,
      website: columnMap.includes("website")
        ? optionalString(record.website)
        : existing?.website,
      note: columnMap.includes("note") ? optionalString(record.note) : existing?.note,
      tags: columnMap.includes("tags") ? tagIds : existing?.tags ?? [],
      favorite: favoriteParsed ?? existing?.favorite ?? false,
      color,
      createdAt: columnMap.includes("createdAt")
        ? optionalString(record.createdAt)
        : existing?.createdAt,
      updatedAt,
      ...(mergedCustomFields ? { customFields: mergedCustomFields } : {}),
      ...(hasDeletedColumn
        ? optionalString(record.deletedAt)
          ? { deletedAt: optionalString(record.deletedAt) }
          : {}
        : existing?.deletedAt
          ? { deletedAt: existing.deletedAt }
          : {}),
    };

    const changedFields = computeChangedFields(existing, item);
    const action: VaultCsvRowAction = existing
      ? changedFields.length
        ? "update"
        : "duplicate"
      : "create";

    items.push(item);
    rowMeta.push({
      row: rowNumber,
      action,
      matchBy,
      changedFields,
      customFields: customFieldsPreview,
    });

    if (action === "update") updates += 1;
    else if (action === "duplicate") duplicates += 1;
    else creates += 1;
  });

  return {
    items,
    rows: rowMeta,
    newTags,
    issues,
    stats: {
      dataRows: dataRows.length,
      importable: items.length,
      creates,
      updates,
      duplicates,
      skipped,
    },
  };
}

export function exportFilename(scope: VaultExportScope): string {
  const date = new Date().toISOString().slice(0, 10);
  if (scope.mode === "all") return `otto-vault-export-${date}.csv`;
  if (scope.mode === "kind") return `otto-vault-${scope.kind}-${date}.csv`;
  return `otto-vault-tag-${date}.csv`;
}

export const vaultKindOptions = kindGroups.flatMap((group) =>
  group.kinds.map((kind) => ({ value: kind.value, label: kind.title }))
);
