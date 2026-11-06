import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const enabled = !!(URL && ANON && SERVICE);

export type Client = SupabaseClient<Database>;

export function admin(): Client {
  return createClient<Database>(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anon(): Client {
  return createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Wipe all app data and the given test users (local test stack only). */
export async function resetAll(emails: string[]) {
  if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error("Refusing to reset a non-local database");
  const a = admin();
  // Order matters because approvals/payments restrict deletes; households cascade the rest.
  for (const t of ["payments", "approvals", "households"] as const) {
    const { error } = await a.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`reset ${t}: ${error.message}`);
  }
  await a.from("audit_log").delete().not("id", "is", null);
  const { data } = await a.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email && emails.includes(u.email)) await a.auth.admin.deleteUser(u.id);
  const { data: objs } = await a.storage.from("household-files").list("", { limit: 1000 });
  for (const folder of objs ?? []) {
    const { data: inner } = await a.storage.from("household-files").list(folder.name, { limit: 1000 });
    if (inner?.length) await a.storage.from("household-files").remove(inner.map((f) => `${folder.name}/${f.name}`));
  }
}

export async function userClient(email: string, password = "test-password-123"): Promise<{ client: Client; id: string }> {
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !/already/.test(error.message)) throw error;
  const c = anon();
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { client: c, id: s.user!.id ?? data.user!.id };
}
