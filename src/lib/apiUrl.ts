const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";

const FUNCTIONS: Record<string, string> = {
  "/api/quotes": "quotes",
  "/api/option-spreads": "option-spreads",
  "/api/books/search": "books-search",
  "/api/books/identify": "books-identify",
  "/api/books/discover": "books-discover",
  "/api/notifications/deliver": "notifications-deliver",
  "/api/notifications/telegram": "notifications-telegram",
};

/**
 * Converts the old Next API paths into Supabase Edge Function URLs. Keeping
 * this mapping in one place lets the bundled APK and browser builds share all
 * client code without depending on a Next/Vercel server.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) return path;
  if (!supabaseUrl) throw new Error("Supabase is not configured.");

  const [pathname, query = ""] = path.split("?", 2);
  const ticker = /^\/api\/ticker\/([^/]+)$/.exec(pathname);
  if (ticker) {
    const params = new URLSearchParams(query);
    params.set("symbol", decodeURIComponent(ticker[1]));
    return `${supabaseUrl}/functions/v1/ticker?${params.toString()}`;
  }

  const functionName = FUNCTIONS[pathname];
  if (!functionName) throw new Error(`No mobile API mapping for ${pathname}.`);
  return `${supabaseUrl}/functions/v1/${functionName}${query ? `?${query}` : ""}`;
}
