import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type ItemUpdate = Database["public"]["Tables"]["required_items"]["Update"];
import { parseWorkbook } from "./parse";
import { planImport, type ExistingState, type ImportPlan, ITEM_FIELD_KEYS } from "./plan";
import { addLibraryChecks, linkTripLocations } from "@/lib/seed";

type DB = SupabaseClient<Database>;

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

async function loadExisting(supabase: DB, householdId: string) {
  const [rooms, items, options, payments] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("household_id", householdId),
    supabase.from("required_items").select("*").eq("household_id", householdId),
    supabase.from("product_options").select("import_key").eq("household_id", householdId).not("import_key", "is", null),
    supabase.from("payments").select("import_key").eq("household_id", householdId).not("import_key", "is", null),
  ]);
  const state: ExistingState = {
    rooms: rooms.data ?? [],
    items: (items.data ?? []).map((i) => ({ ...i, import_snapshot: (i.import_snapshot as ExistingState["items"][number]["import_snapshot"]) ?? null })),
    optionImportKeys: (options.data ?? []).map((o) => o.import_key!),
    paymentImportKeys: (payments.data ?? []).map((p) => p.import_key!),
  };
  return { state, allItems: items.data ?? [] };
}

export async function previewImport(supabase: DB, householdId: string, file: ArrayBuffer) {
  const parsed = await parseWorkbook(file);
  const { state } = await loadExisting(supabase, householdId);
  return { parsed, plan: planImport(parsed, state, new Date().toISOString().slice(0, 10)) };
}

export async function runImport(supabase: DB, householdId: string, file: ArrayBuffer, fileName: string): Promise<ImportPlan> {
  const parsed = await parseWorkbook(file);
  const { state, allItems } = await loadExisting(supabase, householdId);
  const plan = planImport(parsed, state, new Date().toISOString().slice(0, 10));
  const errors: string[] = [];

  // 1. Rooms
  if (plan.roomsToCreate.length) {
    const { error } = await supabase.from("rooms").upsert(
      plan.roomsToCreate.map((r) => ({
        household_id: householdId,
        name: r.name,
        sort_order: r.order,
        source_sheet: r.sheet,
        legacy_prefix: r.prefix,
        is_whole_house: r.isWholeHouse,
      })),
      { onConflict: "household_id,name", ignoreDuplicates: true },
    );
    if (error) errors.push(`Rooms: ${error.message}`);
  }
  const { data: rooms } = await supabase.from("rooms").select("id, name").eq("household_id", householdId);
  const roomId = new Map((rooms ?? []).map((r) => [norm(r.name), r.id]));

  // 2. Items — adopt an item created in the app before the import (e.g. the
  //    seeded "Main sofa") when it is in the same room and has the same text.
  const toInsert = [];
  let adopted = 0;
  for (const c of plan.itemsToCreate) {
    const { roomName, ...fields } = c;
    const rid = roomId.get(norm(roomName));
    if (!rid) {
      errors.push(`No room for ${c.legacy_id}`);
      continue;
    }
    const adopt = allItems.find(
      (i) => !i.legacy_id && i.room_id === rid && (norm(i.specification) === norm(c.specification) || norm(i.name) === norm(c.specification)),
    );
    if (adopt) {
      // Keep anything the owner already typed; fill the rest from the workbook.
      const patch: Record<string, unknown> = { legacy_id: c.legacy_id, import_snapshot: snapshotOf(fields) };
      for (const k of ITEM_FIELD_KEYS) {
        const current = (adopt as Record<string, unknown>)[k];
        if (current === null || current === undefined || current === "" || (k === "sourcing" && current === "undecided")) patch[k] = fields[k];
      }
      if (c.needs_review) Object.assign(patch, { needs_review: true, review_note: c.review_note });
      const { error } = await supabase.from("required_items").update(patch as ItemUpdate).eq("id", adopt.id);
      if (error) errors.push(`${c.legacy_id}: ${error.message}`);
      else adopted++;
      continue;
    }
    toInsert.push({ ...fields, household_id: householdId, room_id: rid, import_snapshot: snapshotOf(fields) });
  }
  for (let i = 0; i < toInsert.length; i += 100) {
    const { error } = await supabase.from("required_items").insert(toInsert.slice(i, i + 100));
    if (error) errors.push(`Items: ${error.message}`);
  }
  for (const u of plan.itemsToUpdate) {
    const { error } = await supabase
      .from("required_items")
      .update({ ...u.changes, import_snapshot: snapshotOf(u.snapshot), ...(u.review ?? {}) })
      .eq("id", u.id);
    if (error) errors.push(`${u.legacyId}: ${error.message}`);
  }

  const { data: items } = await supabase.from("required_items").select("id, legacy_id, name, specification, workbook_category").eq("household_id", householdId);
  const itemByLegacy = new Map((items ?? []).filter((i) => i.legacy_id).map((i) => [i.legacy_id!, i]));

  // 3. Candidate options already named in the workbook
  const suppliersNeeded = [...new Set(plan.optionsToCreate.map((o) => o.supplier_name).filter(Boolean))] as string[];
  if (suppliersNeeded.length) {
    await supabase
      .from("suppliers")
      .upsert(suppliersNeeded.map((name) => ({ household_id: householdId, name })), { onConflict: "household_id,name", ignoreDuplicates: true });
  }
  const { data: suppliers } = await supabase.from("suppliers").select("id, name").eq("household_id", householdId);
  const supplierId = (n: string | null) => (n ? (suppliers ?? []).find((s) => s.name === n)?.id ?? null : null);

  for (const o of plan.optionsToCreate) {
    const item = itemByLegacy.get(o.legacyId);
    if (!item) continue;
    const { commitmentSgd, legacyId, ...fields } = o;
    void legacyId;
    const { data: created, error } = await supabase
      .from("product_options")
      .insert({ ...fields, household_id: householdId, required_item_id: item.id, supplier_id: supplierId(o.supplier_name) })
      .select("id")
      .single();
    if (error || !created) {
      errors.push(`Option for ${o.legacyId}: ${error?.message}`);
      continue;
    }
    await addLibraryChecks(supabase, created.id, item, householdId);
    if (commitmentSgd !== null) {
      const r = await supabase.rpc("record_imported_commitment", {
        p_option_id: created.id,
        p_cost_sgd: commitmentSgd,
        p_note: `Workbook showed an ordered price for ${o.legacyId}. Imported as a commitment flagged for reconciliation.`,
      });
      if (r.error) errors.push(`Commitment ${o.legacyId}: ${r.error.message}`);
    }
  }

  // 4. Payments (linked to the item's active approval when there is one)
  if (plan.paymentsToCreate.length) {
    const { data: approvals } = await supabase.from("approvals").select("id, required_item_id").eq("household_id", householdId).eq("status", "active");
    const activeByItem = new Map((approvals ?? []).map((a) => [a.required_item_id, a.id]));
    const rows = plan.paymentsToCreate.map((p) => {
      const item = p.legacyId ? itemByLegacy.get(p.legacyId) : undefined;
      return {
        household_id: householdId,
        import_key: p.import_key,
        kind: p.kind,
        amount: p.amount,
        currency: p.currency,
        fx_rate: p.fx_rate,
        fx_source: p.currency === "SGD" ? "Base currency" : "Workbook FX",
        amount_sgd: p.amount_sgd,
        paid_on: p.paid_on,
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        required_item_id: item?.id ?? null,
        approval_id: item ? activeByItem.get(item.id) ?? null : null,
        supplier_id: supplierId(p.supplierName),
        is_imported: true,
        needs_reconciliation: true,
      };
    });
    const { error } = await supabase.from("payments").insert(rows);
    if (error) errors.push(`Payments: ${error.message}`);
  }

  // 5. Sourcing guide
  if (plan.guidelines.length) {
    const { error } = await supabase.from("sourcing_guidelines").upsert(
      plan.guidelines.map((g) => ({
        household_id: householdId,
        category: g.category,
        preferred: g.preferred,
        rationale: g.rationale,
        important_check: g.importantCheck,
        sort_order: g.order,
      })),
      { onConflict: "household_id,category" },
    );
    if (error) errors.push(`Sourcing guide: ${error.message}`);
  }

  await linkTripLocations(supabase, householdId);

  for (const e of errors) plan.issues.push({ severity: "conflict", message: `Not saved — ${e}` });
  plan.summary.errors = errors.length;
  if (adopted) {
    plan.summary.items_created -= adopted;
    plan.summary.items_linked = adopted;
  }
  await supabase.from("import_batches").insert({
    household_id: householdId,
    file_name: fileName,
    summary: plan.summary,
    report: JSON.parse(JSON.stringify({ issues: plan.issues, conflicts: plan.conflicts, sheets: parsed.sheetNames })),
  });
  return plan;
}

function snapshotOf(fields: object) {
  return JSON.parse(JSON.stringify(fields));
}
