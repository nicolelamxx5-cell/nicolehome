import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "household-files";

/** Short-lived signed URLs for private files. Never public URLs. */
export async function signedUrls(supabase: SupabaseClient, paths: (string | null | undefined)[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, expiresIn);
  for (const row of data ?? []) if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  return map;
}
