import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_VIA_APP } from "@/lib/supabase/cookie";

export const BUCKET = "household-files";

/** Short-lived signed URLs for private files. Never public URLs. */
export async function signedUrls(supabase: SupabaseClient, paths: (string | null | undefined)[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  for (const row of data ?? []) {
    if (!row.path || !row.signedUrl) continue;
    // Previews: serve photos through this app's /supabase route.
    map.set(row.path, SUPABASE_VIA_APP && base && row.signedUrl.startsWith(base) ? `/supabase${row.signedUrl.slice(base.length)}` : row.signedUrl);
  }
  return map;
}
