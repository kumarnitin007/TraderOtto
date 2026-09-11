"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.replace("/");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      router.replace("/");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).finally(() => {
      router.replace("/positions");
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-otto-bg text-sm text-otto-text-dim">
      Signing you in…
    </div>
  );
}
