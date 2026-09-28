"use client";

import type { ReactNode } from "react";
import { apiUrl } from "@/lib/apiUrl";

declare global {
  interface Window {
    __traderOttoApiBridge?: boolean;
  }
}

/**
 * Existing features still use the original `/api/*` paths. In the packaged
 * app those paths are transparently routed to Supabase Edge Functions.
 */
function installApiBridge() {
  if (typeof window === "undefined" || window.__traderOttoApiBridge) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return nativeFetch(apiUrl(input), init);
    }
    return nativeFetch(input, init);
  };
  window.__traderOttoApiBridge = true;
}

export function ApiBridge({ children }: { children: ReactNode }) {
  installApiBridge();
  return children;
}
