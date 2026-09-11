import { alpacaCredentials, alpacaHeaders } from "@/lib/alpacaServer";
import type { OptionQuote, OptionSnapshot } from "@/lib/optionPricing";

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

export async function fetchOptionSnapshots(symbols: string[]) {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const snapshots: Record<string, OptionSnapshot> = {};
  if (!unique.length) return { ok: true as const, snapshots };

  const creds = alpacaCredentials();
  if (!creds.configured) return { ok: false as const, status: 503, detail: "alpaca_not_configured" };
  const headers = alpacaHeaders(creds.key, creds.secret);

  for (const group of chunk(unique, 50)) {
    const url = new URL("/v1beta1/options/snapshots", creds.dataUrl);
    url.searchParams.set("symbols", group.join(","));
    const response = await fetch(url, { headers, cache: "no-store" });
    const body = await response.text();
    if (!response.ok) {
      return { ok: false as const, status: response.status, detail: body.slice(0, 300) };
    }
    try {
      const data = JSON.parse(body) as { snapshots?: Record<string, OptionSnapshot> };
      Object.assign(snapshots, data.snapshots ?? {});
    } catch {
      return { ok: false as const, status: 502, detail: "snapshot_unparseable" };
    }
  }
  return { ok: true as const, snapshots };
}

export async function fetchOptionQuotes(symbols: string[]) {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const quotes: Record<string, OptionQuote> = {};
  if (!unique.length) return { ok: true as const, quotes };

  const creds = alpacaCredentials();
  if (!creds.configured) return { ok: false as const, status: 503, detail: "alpaca_not_configured" };
  const headers = alpacaHeaders(creds.key, creds.secret);

  for (const group of chunk(unique, 50)) {
    const url = new URL("/v1beta1/options/quotes/latest", creds.dataUrl);
    url.searchParams.set("symbols", group.join(","));
    const response = await fetch(url, { headers, cache: "no-store" });
    const body = await response.text();
    if (!response.ok) {
      return { ok: false as const, status: response.status, detail: body.slice(0, 300) };
    }
    try {
      const data = JSON.parse(body) as { quotes?: Record<string, OptionQuote> };
      Object.assign(quotes, data.quotes ?? {});
    } catch {
      return { ok: false as const, status: 502, detail: "quote_unparseable" };
    }
  }
  return { ok: true as const, quotes };
}
