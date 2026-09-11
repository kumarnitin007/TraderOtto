import { getSupabaseClient } from "@/lib/supabase";

export async function authHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseClient();
  const token = supabase
    ? (await supabase.auth.getSession()).data.session?.access_token
    : undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
