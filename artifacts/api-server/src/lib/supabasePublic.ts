import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | undefined;

function isPublishableKey(key: string): boolean {
  if (key.startsWith("sb_publishable_")) return true;
  if (key.split(".").length !== 3) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    ) as { role?: unknown };
    return payload.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabasePublicClient(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !isPublishableKey(key)) return null;

  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }

  supabaseClient ??= createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return supabaseClient;
}
