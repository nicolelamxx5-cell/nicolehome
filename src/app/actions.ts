"use server";
// All writes go through the signed-in user's Supabase session, so the
// database's row-level security and triggers apply to every action.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext, can } from "@/lib/context";
import { addLibraryChecks } from "@/lib/seed";
import { convertCents, toCents, toScaled } from "@/lib/money";
import { latestRates, rateFor } from "@/lib/finance";
import { detectPlatform } from "@/lib/import/plan";
import type { Database } from "@/lib/database.types";

type ItemUpdate = Database["public"]["Tables"]["required_items"]["Update"];

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function opt<T extends z.ZodType>(s: T) {
  return z.union([z.literal("").transform(() => undefined), s]).optional();
}
const money = z.coerce.number().min(0).max(100_000_000);
const currency = z.string().regex(/^[A-Z]{3}$/);

function fail(e: unknown): ActionResult {
  const msg =
    e instanceof z.ZodError
      ? e.issues[0].message
      : e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message) // Supabase/Postgres errors
          : String(e);
  return { ok: false, error: msg };
}

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function blank(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

// ---------------------------------------------------------------------------
// Required items
// ---------------------------------------------------------------------------
export async function createItem(form: FormData): Promise<ActionResult & { id?: string }> {
  try {
    const { supabase, household } = await getContext();
    const roomId = z.string().uuid().parse(form.get("roomId"));
    const name = z.string().trim().min(1, "Give the item a name").max(200).parse(form.get("name"));
    // A client-chosen id makes this safe to retry from the offline queue.
    const id = form.get("id") ? z.string().uuid().parse(form.get("id")) : crypto.randomUUID();
    const { error } = await supabase
      .from("required_items")
      .upsert({ id, household_id: household.id, room_id: roomId, name }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateItem(itemId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, member } = await getContext();
    const patch: ItemUpdate = {
      name: z.string().trim().min(1).max(200).parse(form.get("name")),
      sourcing: z.enum(["china", "singapore", "compare", "undecided"]).parse(form.get("sourcing")),
      quantity: z.coerce.number().positive().parse(form.get("quantity") || 1),
      unit: blank(form.get("unit")),
      notes: blank(form.get("notes")),
      dimensions_finish: blank(form.get("dimensions_finish")),
      budget_category_id: blank(form.get("budget_category_id")),
    };
    if (can(member, "budget") && form.has("estimate_unit")) {
      const v = blank(form.get("estimate_unit"));
      patch.estimate_unit = v === null ? null : money.parse(v);
    }
    if (form.has("needs_review")) patch.needs_review = form.get("needs_review") === "on";
    const { error } = await supabase.from("required_items").update(patch).eq("id", itemId);
    if (error) throw error;
    return done("Saved");
  } catch (e) {
    return fail(e);
  }
}

export async function archiveItem(itemId: string, archived: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("required_items").update({ is_archived: archived }).eq("id", itemId);
    if (error) throw error;
    return done(archived ? "Item archived" : "Item restored");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Product options
// ---------------------------------------------------------------------------

/** Create one option per screenshot (or one from a link) — the capture flow. */
export async function createOptions(input: {
  itemId: string;
  options: { id: string; title?: string; url?: string; price?: number | null; currency?: string | null; supplier?: string; notes?: string }[];
}): Promise<ActionResult & { ids?: string[] }> {
  try {
    const { supabase, household } = await getContext();
    const itemId = z.string().uuid().parse(input.itemId);
    const { data: item } = await supabase.from("required_items").select("id, name, specification, workbook_category").eq("id", itemId).single();
    if (!item) throw new Error("Item not found");
    const rows = input.options.map((o) => ({
      id: z.string().uuid().parse(o.id),
      household_id: household.id,
      required_item_id: itemId,
      title: (o.title?.trim() || item.name).slice(0, 300),
      url: o.url && /^https?:\/\//i.test(o.url.trim()) ? o.url.trim() : null,
      platform: detectPlatform(o.url ?? null),
      price: o.price ?? null,
      currency: o.price != null ? (o.currency ?? null) : null,
      supplier_name: o.supplier?.trim() || null,
      notes: o.notes?.trim() || null,
      status: "wishlist" as const,
    }));
    const { error } = await supabase.from("product_options").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw error;
    for (const r of rows) await addLibraryChecks(supabase, r.id, item, household.id);
    revalidatePath("/", "layout");
    return { ok: true, ids: rows.map((r) => r.id) };
  } catch (e) {
    return fail(e);
  }
}

export async function registerImages(optionId: string, images: { path: string; thumbPath?: string | null; width?: number; height?: number }[]): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const prefix = `${household.id}/options/${optionId}/`;
    for (const img of images) {
      if (!img.path.startsWith(prefix) || (img.thumbPath && !img.thumbPath.startsWith(prefix))) throw new Error("Unexpected file location");
    }
    const { count } = await supabase.from("option_images").select("id", { count: "exact", head: true }).eq("option_id", optionId);
    const { error } = await supabase.from("option_images").upsert(
      images.map((img, i) => ({
        household_id: household.id,
        option_id: optionId,
        storage_path: img.path,
        thumb_path: img.thumbPath ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        sort_order: (count ?? 0) + i,
      })),
      { onConflict: "storage_path", ignoreDuplicates: true },
    );
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteImage(imageId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { data: img } = await supabase.from("option_images").select("*").eq("id", imageId).single();
    if (!img) throw new Error("Photo not found");
    const { error } = await supabase.from("option_images").delete().eq("id", imageId);
    if (error) throw error;
    await supabase.storage.from("household-files").remove([img.storage_path, img.thumb_path].filter(Boolean) as string[]);
    return done("Photo removed");
  } catch (e) {
    return fail(e);
  }
}

const OptionForm = z.object({
  title: z.string().trim().min(1, "Give the option a name").max(300),
  url: opt(z.string().trim().url("Enter a full link starting with http")),
  platform: z.string().max(40),
  supplier_name: z.string().trim().max(160).optional(),
  contact: z.string().trim().max(300).optional(),
  model_sku: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  dimensions: z.string().trim().max(500).optional(),
  material: z.string().trim().max(500).optional(),
  colour: z.string().trim().max(200).optional(),
  configuration: z.string().trim().max(500).optional(),
  price: opt(money),
  currency: opt(currency),
  price_basis: z.enum(["observed", "estimate", "quoted", "confirmed"]),
  price_note: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number().positive().max(100000),
  other_charges: opt(money),
  freight_allowance: opt(money),
  freight_currency: opt(currency),
  notes: z.string().trim().max(4000).optional(),
});

export async function updateOption(optionId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const f = OptionForm.parse(Object.fromEntries(form));
    if (f.freight_allowance && !f.freight_currency) throw new Error("Choose the freight allowance currency");
    const nul = (v: string | undefined) => (v === undefined || v === "" ? null : v);
    const { error } = await supabase
      .from("product_options")
      .update({
        title: f.title,
        url: nul(f.url),
        platform: f.platform,
        supplier_name: nul(f.supplier_name),
        contact: nul(f.contact),
        model_sku: nul(f.model_sku),
        description: nul(f.description),
        dimensions: nul(f.dimensions),
        material: nul(f.material),
        colour: nul(f.colour),
        configuration: nul(f.configuration),
        price: f.price ?? null,
        currency: f.price === undefined ? null : (f.currency ?? null),
        price_basis: f.price_basis,
        price_note: nul(f.price_note),
        quantity: f.quantity,
        other_charges: f.other_charges ?? null,
        freight_allowance: f.freight_allowance ?? null,
        freight_currency: f.freight_allowance ? (f.freight_currency ?? null) : null,
        notes: nul(f.notes),
      })
      .eq("id", optionId);
    if (error) throw error;
    return done("Saved");
  } catch (e) {
    return fail(e);
  }
}

const tri = z.enum(["yes", "no", "unknown"]);
export async function updateWarranty(optionId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const g = (k: string) => blank(form.get(k));
    const { error } = await supabase
      .from("product_options")
      .update({
        warranty_provided: tri.parse(form.get("warranty_provided")),
        warranty_duration: g("warranty_duration"),
        warranty_start_basis: g("warranty_start_basis"),
        warranty_provider: g("warranty_provider"),
        warranty_coverage: g("warranty_coverage"),
        warranty_exclusions: g("warranty_exclusions"),
        warranty_valid_sg: tri.parse(form.get("warranty_valid_sg")),
        warranty_local_service: tri.parse(form.get("warranty_local_service")),
        warranty_parts: tri.parse(form.get("warranty_parts")),
        warranty_verified: form.get("warranty_verified") === "on",
        warranty_notes: g("warranty_notes"),
      })
      .eq("id", optionId);
    if (error) throw error;
    return done("Warranty saved");
  } catch (e) {
    return fail(e);
  }
}

export async function setOptionStatus(optionId: string, status: "wishlist" | "shortlisted" | "pending_confirmation" | "cancelled"): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const s = z.enum(["wishlist", "shortlisted", "pending_confirmation", "cancelled"]).parse(status);
    const { error } = await supabase.from("product_options").update({ status: s }).eq("id", optionId);
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function moveOption(optionId: string, itemId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { data: o } = await supabase.from("product_options").select("status").eq("id", optionId).single();
    if (o && ["approved", "ordered"].includes(o.status)) throw new Error("Withdraw the approval before moving this option");
    const { error } = await supabase.from("product_options").update({ required_item_id: z.string().uuid().parse(itemId) }).eq("id", optionId);
    if (error) throw error;
    return done("Moved");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOption(optionId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { data: o } = await supabase.from("product_options").select("required_item_id, status").eq("id", optionId).single();
    if (!o) throw new Error("Option not found");
    const { count } = await supabase.from("approvals").select("id", { count: "exact", head: true }).eq("option_id", optionId);
    if (count) throw new Error("This option has approval history, so it is kept. Mark it as cancelled instead.");
    const { data: imgs } = await supabase.from("option_images").select("storage_path, thumb_path").eq("option_id", optionId);
    const { error, count: deleted } = await supabase.from("product_options").delete({ count: "exact" }).eq("id", optionId);
    if (error) throw error;
    if (!deleted) throw new Error("Only the person who added it, or the owner, can delete this option");
    const paths = (imgs ?? []).flatMap((i) => [i.storage_path, i.thumb_path]).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("household-files").remove(paths);
    revalidatePath("/", "layout");
  } catch (e) {
    return fail(e);
  }
  redirect("/shop");
}

// ---------------------------------------------------------------------------
// Comments & preferences
// ---------------------------------------------------------------------------
export async function addComment(optionId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const body = z.string().trim().min(1, "Write a comment first").max(4000).parse(form.get("body"));
    const { error } = await supabase.from("option_comments").insert({ household_id: household.id, option_id: optionId, body });
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("option_comments").delete().eq("id", commentId);
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function setPreference(optionId: string, vote: "love" | "like" | "unsure" | "no" | null): Promise<ActionResult> {
  try {
    const { supabase, household, userId } = await getContext();
    if (vote === null) {
      await supabase.from("option_preferences").delete().eq("option_id", optionId).eq("user_id", userId);
    } else {
      const v = z.enum(["love", "like", "unsure", "no"]).parse(vote);
      const { error } = await supabase
        .from("option_preferences")
        .upsert({ household_id: household.id, option_id: optionId, user_id: userId, vote: v, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Purchase checks
// ---------------------------------------------------------------------------
export async function setCheck(checkId: string, state: "pending" | "confirmed" | "not_applicable" | "failed", evidence?: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await getContext();
    const s = z.enum(["pending", "confirmed", "not_applicable", "failed"]).parse(state);
    const { error } = await supabase
      .from("option_checks")
      .update({
        state: s,
        evidence: evidence?.trim() || null,
        resolved_by: s === "pending" ? null : userId,
        resolved_at: s === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", checkId);
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function addCheck(optionId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const title = z.string().trim().min(3, "Describe what needs checking").max(300).parse(form.get("title"));
    const { error } = await supabase
      .from("option_checks")
      .insert({ household_id: household.id, option_id: optionId, title, critical: form.get("critical") === "on" });
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Approvals (owner, or anyone the owner has given approval rights)
// ---------------------------------------------------------------------------
export async function approveOption(optionId: string, note?: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.rpc("approve_option", { p_option_id: optionId, p_note: note?.trim() || undefined });
    if (error) throw error;
    return done("Approved. Its cost now counts as committed.");
  } catch (e) {
    return fail(e);
  }
}

export async function revokeApproval(approvalId: string, reason?: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.rpc("revoke_approval", { p_approval_id: approvalId, p_reason: reason?.trim() || undefined });
    if (error) throw error;
    return done("Approval withdrawn");
  } catch (e) {
    return fail(e);
  }
}

export async function markOrdered(approvalId: string, override?: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.rpc("mark_ordered", { p_approval_id: approvalId, p_override_note: override?.trim() || undefined });
    if (error) throw error;
    return done("Marked as ordered");
  } catch (e) {
    return fail(e);
  }
}

export async function cancelApproval(approvalId: string, reason: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.rpc("cancel_approval", { p_approval_id: approvalId, p_reason: reason });
    if (error) throw error;
    return done("Cancelled. Payments already made stay on record — add a refund if you get money back.");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
async function resolveRate(supabase: Awaited<ReturnType<typeof getContext>>["supabase"], householdId: string, cur: string, manual?: number) {
  if (cur === "SGD") return { rate: 1, source: "Base currency" };
  if (manual && manual > 0) return { rate: Number(toScaled(manual, 8)) / 1e8, source: "Entered with payment" };
  const { data } = await supabase.from("exchange_rates").select("*").eq("household_id", householdId).eq("currency", cur);
  const r = rateFor(cur, latestRates(data ?? []));
  if (!r) throw new Error(`Add an exchange rate for ${cur} first (Budget → Exchange rates), or enter the rate used.`);
  return { rate: Number(r.rate_to_sgd), source: `${r.source} (${r.as_of})` };
}

export async function recordPayment(form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household, member } = await getContext();
    if (!can(member, "payments")) throw new Error("You do not have permission to record payments");
    const f = z
      .object({
        target: z.string().min(1, "Choose what this payment is for"),
        kind: z.enum(["deposit", "progress", "balance", "full", "refund", "other"]),
        amount: z.coerce.number().positive("Enter the amount paid"),
        currency,
        fx_rate: opt(z.coerce.number().positive()),
        paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the payment date"),
        method: z.string().trim().max(80).optional(),
        reference: z.string().trim().max(160).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(Object.fromEntries(form));
    const { rate, source } = await resolveRate(supabase, household.id, f.currency, f.fx_rate);
    const amountCents = toCents(f.amount)!;
    const [type, id] = f.target.split(":");
    const link =
      type === "approval" ? { approval_id: id } : type === "shared" ? { shared_cost_id: id } : type === "item" ? { required_item_id: id } : {};
    const { error } = await supabase.from("payments").insert({
      household_id: household.id,
      ...link,
      kind: f.kind,
      amount: amountCents / 100,
      currency: f.currency,
      fx_rate: rate,
      fx_source: source,
      amount_sgd: convertCents(amountCents, rate) / 100,
      paid_on: f.paid_on,
      method: f.method || null,
      reference: f.reference || null,
      notes: f.notes || null,
    });
    if (error) throw error;
    return done("Payment recorded");
  } catch (e) {
    return fail(e);
  }
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) throw error;
    return done("Payment deleted");
  } catch (e) {
    return fail(e);
  }
}

export async function addRate(form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const f = z
      .object({
        currency: currency.refine((c) => c !== "SGD", "SGD is the base currency"),
        rate: z.coerce.number().positive("Enter how many SGD one unit is worth"),
        as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        source: z.string().trim().min(1).max(200),
      })
      .parse(Object.fromEntries(form));
    const { error } = await supabase
      .from("exchange_rates")
      .insert({ household_id: household.id, currency: f.currency, rate_to_sgd: f.rate, as_of: f.as_of, source: f.source, is_manual: true });
    if (error) throw error;
    return done("Rate saved");
  } catch (e) {
    return fail(e);
  }
}

/** Fetch a reference rate (European Central Bank via frankfurter.app). Always dated and labelled. */
export async function fetchReferenceRate(cur: string): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const c = currency.parse(cur);
    const res = await fetch(`https://api.frankfurter.app/latest?from=${c}&to=SGD`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("The rate service did not respond. Enter the rate manually instead.");
    const j = (await res.json()) as { date?: string; rates?: { SGD?: number } };
    if (!j.rates?.SGD || !j.date) throw new Error("No rate returned. Enter the rate manually instead.");
    const { error } = await supabase.from("exchange_rates").insert({
      household_id: household.id,
      currency: c,
      rate_to_sgd: j.rates.SGD,
      as_of: j.date,
      source: "ECB reference rate (frankfurter.app)",
      is_manual: false,
    });
    if (error) throw error;
    return done(`1 ${c} = S$${j.rates.SGD} (ECB, ${j.date})`);
  } catch (e) {
    return fail(e);
  }
}

export async function saveSharedCost(form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const f = z
      .object({
        id: opt(z.string().uuid()),
        name: z.string().trim().min(1).max(160),
        amount: z.coerce.number().min(0),
        currency,
        fx_rate: opt(z.coerce.number().positive()),
        status: z.enum(["forecast", "committed", "cancelled"]),
        allocation: z.enum(["by_value", "equal"]),
        applies_to: z.enum(["china", "all"]),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(Object.fromEntries(form));
    const { rate, source } = await resolveRate(supabase, household.id, f.currency, f.fx_rate);
    const cents = toCents(f.amount)!;
    const row = {
      household_id: household.id,
      name: f.name,
      amount: cents / 100,
      currency: f.currency,
      fx_rate: rate,
      fx_source: source,
      amount_sgd: convertCents(cents, rate) / 100,
      status: f.status,
      allocation: f.allocation,
      applies_to: f.applies_to,
      notes: f.notes || null,
    };
    const { error } = f.id ? await supabase.from("shared_costs").update(row).eq("id", f.id) : await supabase.from("shared_costs").insert(row);
    if (error) throw error;
    return done("Saved");
  } catch (e) {
    return fail(e);
  }
}

export async function saveBudgets(form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const num = (v: FormDataEntryValue | null) => {
      const s = blank(v);
      return s === null ? null : money.parse(s);
    };
    const { error } = await supabase
      .from("households")
      .update({ total_budget: num(form.get("total_budget")), contingency: num(form.get("contingency")) ?? 0 })
      .eq("id", household.id);
    if (error) throw error;
    for (const [k, v] of form.entries()) {
      if (k.startsWith("room:")) {
        const { error: e } = await supabase.from("rooms").update({ budget: num(v) }).eq("id", k.slice(5));
        if (e) throw e;
      }
      if (k.startsWith("cat:")) {
        const { error: e } = await supabase.from("budget_categories").update({ budget: num(v) }).eq("id", k.slice(4));
        if (e) throw e;
      }
    }
    return done("Budgets saved");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Household & permissions (owner)
// ---------------------------------------------------------------------------
export async function inviteMember(form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household, member } = await getContext();
    if (member.role !== "owner") throw new Error("Only the owner can invite people");
    const email = z.string().trim().toLowerCase().email("Enter a valid email").parse(form.get("email"));
    const name = z.string().trim().max(60).parse(form.get("display_name") ?? "");
    const { error } = await supabase.from("household_invites").insert({ household_id: household.id, email, display_name: name });
    if (error) throw new Error(error.code === "23505" ? "That email already has an open invitation" : error.message);
    return done(`Invitation saved. Ask ${name || email} to create an account with ${email}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function cancelInvite(inviteId: string): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("household_invites").delete().eq("id", inviteId);
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemberPermissions(userId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const on = (k: string) => form.get(k) === "on";
    const { error } = await supabase
      .from("household_members")
      .update({
        can_approve: on("can_approve"),
        can_record_payments: on("can_record_payments"),
        can_edit_budget: on("can_edit_budget"),
        can_export: on("can_export"),
        can_manage_items: on("can_manage_items"),
      })
      .eq("household_id", household.id)
      .eq("user_id", userId);
    if (error) throw error;
    return done("Permissions updated");
  } catch (e) {
    return fail(e);
  }
}

export async function updateMyName(form: FormData): Promise<ActionResult> {
  try {
    const { supabase, household, userId } = await getContext();
    const name = z.string().trim().min(1).max(60).parse(form.get("display_name"));
    const { error } = await supabase.from("household_members").update({ display_name: name }).eq("household_id", household.id).eq("user_id", userId);
    if (error) throw error;
    return done("Saved");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Trip guide
// ---------------------------------------------------------------------------
export async function toggleLocationItem(locationId: string, itemId: string, linked: boolean): Promise<ActionResult> {
  try {
    const { supabase, household } = await getContext();
    const { error } = linked
      ? await supabase.from("location_items").upsert({ location_id: locationId, required_item_id: itemId, household_id: household.id }, { ignoreDuplicates: true })
      : await supabase.from("location_items").delete().eq("location_id", locationId).eq("required_item_id", itemId);
    if (error) throw error;
    return done();
  } catch (e) {
    return fail(e);
  }
}

export async function updateLocation(locationId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const address = blank(form.get("address"));
    const verified = form.get("address_verified") === "on";
    if (address && !verified) throw new Error("Tick “I have verified this address” to save it — unverified addresses are not stored.");
    const { error } = await supabase
      .from("shopping_locations")
      .update({ address: verified ? address : null, address_verified: verified && !!address, verification_note: blank(form.get("verification_note")), notes: blank(form.get("notes")) })
      .eq("id", locationId);
    if (error) throw error;
    return done("Saved");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Screenshot suggestions (never applied automatically)
// ---------------------------------------------------------------------------
const SUGGESTION_FIELDS = {
  product_name: "title",
  dimensions: "dimensions",
  colour: "colour",
  material: "material",
  supplier_or_shop: "supplier_name",
  model_number: "model_sku",
} as const;

export async function applySuggestion(optionId: string, field: keyof typeof SUGGESTION_FIELDS | "price"): Promise<ActionResult> {
  try {
    const { supabase } = await getContext();
    const { data: o } = await supabase.from("product_options").select("ai_suggestions").eq("id", optionId).single();
    const s = (o?.ai_suggestions ?? null) as null | Record<string, { value: string | null } | number | string | null>;
    if (!s) throw new Error("No suggestions to apply");
    if (field === "price") {
      const amount = typeof s.price_amount === "number" ? s.price_amount : null;
      if (amount === null) throw new Error("No price was read");
      const cur = typeof s.price_currency === "string" && /^[A-Z]{3}$/.test(s.price_currency) ? s.price_currency : null;
      const { error } = await supabase
        .from("product_options")
        .update({ price: amount, currency: cur, price_basis: "observed", price_note: "Read from screenshot — check it matches the variant you want." })
        .eq("id", optionId);
      if (error) throw error;
    } else {
      const column = SUGGESTION_FIELDS[field];
      const entry = s[field] as { value: string | null } | null;
      if (!column || !entry?.value) throw new Error("Nothing to apply");
      const patch: Database["public"]["Tables"]["product_options"]["Update"] = { [column]: entry.value.slice(0, 300) };
      const { error } = await supabase.from("product_options").update(patch).eq("id", optionId);
      if (error) throw error;
    }
    return done("Applied — please check it");
  } catch (e) {
    return fail(e);
  }
}
