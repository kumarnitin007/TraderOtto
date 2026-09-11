import { NextResponse } from "next/server";

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

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    return NextResponse.json({ ok: false, reason: "missing_url" }, { status: 500 });
  }

  try {
    const headers = key
      ? {
          apikey: key,
          Authorization: `Bearer ${key}`,
        }
      : undefined;
    const [healthResponse, settingsResponse] = await Promise.all([
      fetch(`${url}/auth/v1/health`, { cache: "no-store", headers }),
      fetch(`${url}/auth/v1/settings`, { cache: "no-store", headers }),
    ]);
    const body = await healthResponse.text();
    const settings = settingsResponse.ok
      ? ((await settingsResponse.json()) as {
          disable_signup?: boolean;
          external?: Record<string, boolean>;
        })
      : null;
    const role = keyRole(key);
    return NextResponse.json({
      ok: healthResponse.ok && role === "anon",
      status: healthResponse.status,
      keyPresent: Boolean(key),
      keyRole: role,
      signupEnabled: settings ? settings.disable_signup !== true : null,
      google: Boolean(settings?.external?.google),
      apple: Boolean(settings?.external?.apple),
      email: settings?.external?.email !== false,
      health: body.slice(0, 200),
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" }, { status: 503 });
  }
}
