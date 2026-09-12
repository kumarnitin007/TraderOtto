function keyRole(key?: string) {
  if (!key) return null;
  try {
    const payload = key.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      role?: string;
    };
    return json.role ?? null;
  } catch {
    return null;
  }
}

export type SupabaseAuthStatus = {
  ok: boolean;
  google: boolean;
  apple: boolean;
};

/** Auth health + which OAuth providers are enabled (served via GET /api/quotes?auth=1). */
export async function fetchSupabaseAuthStatus(): Promise<SupabaseAuthStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const empty = { ok: false, google: false, apple: false };
  if (!url || !key) return empty;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  try {
    const [healthResponse, settingsResponse] = await Promise.all([
      fetch(`${url}/auth/v1/health`, { cache: "no-store", headers }),
      fetch(`${url}/auth/v1/settings`, { cache: "no-store", headers }),
    ]);
    const settings = settingsResponse.ok
      ? ((await settingsResponse.json()) as { external?: Record<string, boolean> })
      : null;
    return {
      ok: healthResponse.ok && keyRole(key) === "anon",
      google: Boolean(settings?.external?.google),
      apple: Boolean(settings?.external?.apple),
    };
  } catch {
    return empty;
  }
}
