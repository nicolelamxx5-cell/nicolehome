import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Member = Database["public"]["Tables"]["household_members"]["Row"];
export type Household = Database["public"]["Tables"]["households"]["Row"];
export type Perm = "approve" | "payments" | "budget" | "export" | "manage";

export function can(member: Member, perm: Perm): boolean {
  if (member.role === "owner") return true;
  switch (perm) {
    case "approve":
      return member.can_approve;
    case "payments":
      return member.can_record_payments;
    case "budget":
      return member.can_edit_budget;
    case "export":
      return member.can_export;
    case "manage":
      return member.can_manage_items;
  }
}

/** The signed-in user without requiring a household (setup flow). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { supabase, userId: claims.sub as string, email: (claims.email as string | undefined) ?? "" };
});

/** Signed-in user + household membership. Redirects to setup if not a member yet. */
export const getContext = cache(async () => {
  const { supabase, userId, email } = await getUser();
  // One parallel round trip: row-level security already limits both queries to
  // the user's own household, so there is nothing to look up first.
  const [{ data: members }, { data: households }] = await Promise.all([
    supabase.from("household_members").select("*"),
    supabase.from("households").select("*"),
  ]);
  const member = (members ?? []).find((m) => m.user_id === userId);
  if (!member) redirect("/setup");
  const household = (households ?? []).find((h) => h.id === member.household_id);
  if (!household) redirect("/setup");
  const names = new Map((members ?? []).map((m) => [m.user_id, m.display_name || (m.role === "owner" ? "Owner" : "Member")]));
  return { supabase, userId, email, member, household, names };
});

export type Ctx = Awaited<ReturnType<typeof getContext>>;
