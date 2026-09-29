const KEY = "trader-otto:vault-health-banner";

type Stored = { until: number | "forever" };

export function readHealthBannerHide(now = Date.now()): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.until === "forever") return parsed;
    if (typeof parsed.until === "number" && parsed.until > now) return parsed;
    window.localStorage.removeItem(KEY);
    return null;
  } catch {
    return null;
  }
}

export function hideHealthBanner(days?: number) {
  const until = days == null ? "forever" : Date.now() + days * 86_400_000;
  window.localStorage.setItem(KEY, JSON.stringify({ until }));
  return { until } satisfies Stored;
}

export function showHealthBanner() {
  window.localStorage.removeItem(KEY);
}
