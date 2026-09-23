"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileUp,
  Upload,
  X,
} from "lucide-react";
import { kindMeta } from "@/lib/vaultItemTypes";
import {
  downloadVaultCsv,
  exportFilename,
  filterItemsForExport,
  parseVaultCsv,
  vaultItemsToCsv,
  vaultKindOptions,
  type VaultCsvImportPreview,
  type VaultCsvImportRowMeta,
  type VaultExportScope,
} from "@/lib/vaultCsv";
import type { VaultItem, VaultKind, VaultTag } from "@/lib/vaultRepository";

type ExportMode = VaultExportScope["mode"];

export function VaultDataTransfer({
  items,
  tags,
  onClose,
  onImport,
}: {
  items: VaultItem[];
  tags: VaultTag[];
  onClose: () => void;
  onImport: (items: VaultItem[], newTags: VaultTag[]) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportMode, setExportMode] = useState<ExportMode>("all");
  const [exportKind, setExportKind] = useState<VaultKind>("login");
  const [exportTagId, setExportTagId] = useState<string>(() => tags[0]?.id ?? "");
  const [preview, setPreview] = useState<VaultCsvImportPreview | null>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const exportScope = useMemo((): VaultExportScope => {
    if (exportMode === "kind") return { mode: "kind", kind: exportKind };
    if (exportMode === "tag") return { mode: "tag", tagId: exportTagId };
    return { mode: "all" };
  }, [exportMode, exportKind, exportTagId]);

  const exportCount = useMemo(
    () => filterItemsForExport(items, exportScope).length,
    [items, exportScope]
  );

  const blockingErrors = useMemo(
    () => preview?.issues.filter((issue) => issue.severity === "error") ?? [],
    [preview]
  );

  const warnings = useMemo(
    () => preview?.issues.filter((issue) => issue.severity === "warning") ?? [],
    [preview]
  );

  function handleExport() {
    const confirmed = window.confirm(
      "This CSV will contain readable passwords and secrets. Store it securely and delete it when finished. Continue?"
    );
    if (!confirmed) return;
    const subset = filterItemsForExport(items, exportScope);
    const csv = vaultItemsToCsv(subset, tags);
    downloadVaultCsv(exportFilename(exportScope), csv);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFileLabel(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const nextPreview = parseVaultCsv(text, items, tags);
      setPreview(nextPreview);
      setSelectedIds(
        new Set(
          nextPreview.items
            .filter((_, index) => nextPreview.rows[index]?.action !== "duplicate")
            .map((item) => item.id)
        )
      );
    };
    reader.onerror = () => {
      setPreview({
        items: [],
        rows: [],
        newTags: [],
        issues: [{ message: "Could not read the selected file.", severity: "error" }],
        stats: {
          dataRows: 0,
          importable: 0,
          creates: 0,
          updates: 0,
          duplicates: 0,
          skipped: 0,
        },
      });
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!preview || blockingErrors.length || !selectedIds.size) return;
    const selectedItems = preview.items.filter((item) => selectedIds.has(item.id));
    const usedTagIds = new Set(selectedItems.flatMap((item) => item.tags));
    const selectedNewTags = preview.newTags.filter((tag) => usedTagIds.has(tag.id));
    setImporting(true);
    try {
      await onImport(selectedItems, selectedNewTags);
      setPreview(null);
      setFileLabel("");
      onClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-otto-bg">
      <header className="flex shrink-0 items-center justify-between border-b border-otto-divider px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-otto-surface"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <b className="text-[15px] font-bold">Import & export</b>
        <span className="w-9" />
      </header>

      <div className="mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-[18px] py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-otto-text-faint">
          Vault data
        </p>
        <h1 className="mb-4 text-[24px] font-extrabold">CSV transfer</h1>
        <p className="mb-5 text-[14px] leading-relaxed text-otto-text-dim">
          Export a subset of your vault or import items from a vault-format CSV. Journal trade
          exports are not supported here.
        </p>
        <div className="mb-5 rounded-xl border border-otto-amber/35 bg-otto-amber-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-otto-text-dim">
          CSV exports are plaintext and include readable secrets. They are not protected by your
          master password.
        </div>

        <section className="mb-5 rounded-2xl bg-otto-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Download size={18} className="text-otto-text-dim" />
            <h2 className="text-[15px] font-bold">Export</h2>
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">Export scope</legend>
            <ScopeOption
              checked={exportMode === "all"}
              onChange={() => setExportMode("all")}
              label="All items"
              detail={`${items.length} total`}
            />
            <ScopeOption
              checked={exportMode === "kind"}
              onChange={() => setExportMode("kind")}
              label="By category"
              detail="One vault kind"
            />
            <ScopeOption
              checked={exportMode === "tag"}
              onChange={() => setExportMode("tag")}
              label="By tag"
              detail="Items with a tag"
            />
          </fieldset>

          {exportMode === "kind" && (
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-medium text-otto-text-dim">
                Category
              </span>
              <select
                value={exportKind}
                onChange={(event) => setExportKind(event.target.value as VaultKind)}
                className="w-full rounded-[10px] border border-otto-divider bg-otto-bg px-3 py-2.5 text-[15px]"
              >
                {vaultKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {exportMode === "tag" && (
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-medium text-otto-text-dim">Tag</span>
              <select
                value={exportTagId}
                onChange={(event) => setExportTagId(event.target.value)}
                disabled={!tags.length}
                className="w-full rounded-[10px] border border-otto-divider bg-otto-bg px-3 py-2.5 text-[15px] disabled:opacity-50"
              >
                {!tags.length ? (
                  <option value="">No tags yet</option>
                ) : (
                  tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={handleExport}
            disabled={exportCount === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-otto-green py-3 text-[15px] font-semibold text-black disabled:opacity-40"
          >
            <Download size={17} />
            Download CSV ({exportCount})
          </button>
        </section>

        <section className="rounded-2xl bg-otto-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Upload size={18} className="text-otto-text-dim" />
            <h2 className="text-[15px] font-bold">Import</h2>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-otto-divider bg-otto-bg py-4 text-[14px] font-medium text-otto-text-dim hover:border-otto-text-faint"
          >
            <FileUp size={18} />
            {fileLabel ? fileLabel : "Choose CSV file"}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadVaultCsv(
                "otto-vault-import-template.csv",
                vaultItemsToCsv([], tags)
              )
            }
            className="mt-2 w-full py-2 text-[13px] font-semibold text-otto-green"
          >
            Download import template
          </button>

          {preview && (
            <div className="mt-4 space-y-3">
              <ImportSummary preview={preview} />

              {blockingErrors.length > 0 && (
                <IssueList title="Errors" issues={blockingErrors} tone="error" />
              )}

              {warnings.length > 0 && (
                <IssueList title="Warnings" issues={warnings} tone="warning" />
              )}

              {preview.items.length > 0 && (
                <div className="rounded-xl bg-otto-bg px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-otto-text-faint">
                      Select items
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(
                          selectedIds.size === preview.items.length
                            ? new Set()
                            : new Set(preview.items.map((item) => item.id))
                        )
                      }
                      className="text-[12px] font-semibold text-otto-green"
                    >
                      {selectedIds.size === preview.items.length ? "Select none" : "Select all"}
                    </button>
                  </div>
                  <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                    {preview.items.map((item, index) => {
                      const meta = preview.rows[index];
                      return (
                        <li
                          key={`${item.id}-${item.name}-${meta?.row ?? index}`}
                          className="rounded-lg bg-otto-surface/80 text-[13px]"
                        >
                          <label className="flex cursor-pointer items-start gap-2 px-2 py-2 hover:bg-otto-surface">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() =>
                                setSelectedIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                })
                              }
                              className="mt-0.5 h-4 w-4 shrink-0 accent-otto-green"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <i
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                  aria-hidden
                                />
                                <span className="font-medium">{item.name}</span>
                                <span className="text-otto-text-faint">
                                  {kindMeta(item.kind).title}
                                </span>
                              </span>
                              {meta && (
                                <ImportRowDetails meta={meta} />
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={
                  importing || blockingErrors.length > 0 || selectedIds.size === 0
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-otto-green py-3 text-[15px] font-semibold text-black disabled:opacity-40"
              >
                {importing
                  ? "Importing…"
                  : `Confirm import (${selectedIds.size} item${
                      selectedIds.size === 1 ? "" : "s"
                    })`}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ScopeOption({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-otto-bg px-3 py-2.5">
      <input
        type="radio"
        name="export-scope"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-otto-green"
      />
      <span className="flex-1 text-[14px] font-medium">{label}</span>
      <small className="text-[12px] text-otto-text-faint">{detail}</small>
    </label>
  );
}

function ImportSummary({ preview }: { preview: VaultCsvImportPreview }) {
  const { stats } = preview;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Rows" value={stats.dataRows} />
      <Stat label="Import" value={stats.importable} />
      <Stat label="New" value={stats.creates} />
      <Stat label="Update" value={stats.updates} />
      <Stat label="Duplicate" value={stats.duplicates} />
      {stats.skipped > 0 && (
        <div className="col-span-2 sm:col-span-4">
          <Stat label="Skipped" value={stats.skipped} muted />
        </div>
      )}
      {preview.newTags.length > 0 && (
        <div className="col-span-2 sm:col-span-4 text-[13px] text-otto-text-dim">
          {preview.newTags.length} new tag{preview.newTags.length === 1 ? "" : "s"} will be
          created.
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 ${muted ? "bg-otto-bg/60" : "bg-otto-bg"}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-otto-text-faint">{label}</p>
      <p className="text-[18px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ImportRowDetails({ meta }: { meta: VaultCsvImportRowMeta }) {
  const actionLabel =
    meta.action === "create"
      ? "New"
      : meta.action === "duplicate"
        ? "Duplicate"
        : "Update";
  const matchLabel =
    meta.action !== "create" && meta.matchBy === "id"
      ? "matched by ID"
      : meta.action !== "create" && meta.matchBy === "name_username"
        ? "matched by name + username"
        : null;
  const customEntries = Object.entries(meta.customFields);

  return (
    <span className="mt-1 block space-y-0.5 text-[12px] leading-snug text-otto-text-dim">
      <span>
        <span
          className={
            meta.action === "create"
              ? "font-semibold text-otto-green"
              : meta.action === "duplicate"
                ? "font-semibold text-otto-text-faint"
              : "font-semibold text-otto-amber"
          }
        >
          {actionLabel}
        </span>
        {matchLabel ? ` · ${matchLabel}` : null}
        {meta.row ? ` · row ${meta.row}` : null}
      </span>
      {meta.action === "update" && meta.changedFields.length > 0 && (
        <span className="block">
          Changes: {meta.changedFields.join(", ")}
        </span>
      )}
      {meta.action === "update" && meta.changedFields.length === 0 && (
        <span className="block text-otto-text-faint">No field changes detected.</span>
      )}
      {meta.action === "duplicate" && (
        <span className="block text-otto-text-faint">
          Same data already exists · skipped by default.
        </span>
      )}
      {customEntries.length > 0 && (
        <span className="block">
          Additional fields:{" "}
          {customEntries
            .map(([key, value]) => `${key}=${value}`)
            .join("; ")}
        </span>
      )}
    </span>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { row?: number; field?: string; message: string }[];
  tone: "error" | "warning";
}) {
  const isError = tone === "error";
  return (
    <div
      className={`rounded-xl px-3 py-3 ${
        isError
          ? "bg-otto-red/10 text-otto-red"
          : "border border-otto-amber/35 bg-otto-amber-soft text-otto-amber"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        <AlertTriangle size={16} />
        {title}
      </div>
      <ul className="space-y-1 text-[13px] leading-snug">
        {issues.slice(0, 12).map((issue, index) => (
          <li key={`${issue.row}-${issue.message}-${index}`}>
            {issue.row != null && <span className="font-medium">Row {issue.row}: </span>}
            {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > 12 && (
        <p className="mt-2 text-[12px] opacity-80">+ {issues.length - 12} more</p>
      )}
    </div>
  );
}
