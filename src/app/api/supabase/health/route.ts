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
    const response = await fetch(`${url}/auth/v1/health`, {
      cache: "no-store",
      headers: key
        ? {
            apikey: key,
            Authorization: `Bearer ${key}`,
          }
        : undefined,
    });
    const body = await response.text();
    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      keyPresent: Boolean(key),
      keyRole: keyRole(key),
      health: body.slice(0, 200),
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" }, { status: 503 });
  }
}
