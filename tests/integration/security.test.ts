// Runs against a local Supabase stack (npx supabase start). Verifies the
// database itself enforces permissions — not just the UI.
import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, enabled, resetAll, userClient, type Client } from "./helpers";

const OWNER = "owner.test@example.com";
const KEITH = "keith.test@example.com";
const STRANGER = "stranger.test@example.com";

describe.skipIf(!enabled)("database security and workflow", () => {
  let owner: Client, keith: Client, stranger: Client;
  let ownerId: string, keithId: string;
  let hh: string, room: string, item: string, optA: string, optB: string;

  beforeAll(async () => {
    await resetAll([OWNER, KEITH, STRANGER]);
    ({ client: owner, id: ownerId } = await userClient(OWNER));
    ({ client: keith, id: keithId } = await userClient(KEITH));
    ({ client: stranger } = await userClient(STRANGER));
  });

  it("only the first account can create the household", async () => {
    const { data, error } = await owner.rpc("create_household", { p_name: "661C Edgedale Plains", p_display_name: "Owner" });
    expect(error).toBeNull();
    hh = data!;
    const second = await stranger.rpc("create_household", { p_name: "Mine", p_display_name: "X" });
    expect(second.error?.message).toMatch(/already has a household/);
  });

  it("Keith joins by invitation with review-only permissions", async () => {
    expect((await owner.from("household_invites").insert({ household_id: hh, email: KEITH, display_name: "Keith" })).error).toBeNull();
    // Keith cannot read invites (owner only)
    expect((await keith.from("household_invites").select()).data).toEqual([]);
    const { data } = await keith.rpc("claim_invites");
    expect(data).toBe(hh);
    const { data: me } = await keith.from("household_members").select().eq("user_id", keithId).single();
    expect(me).toMatchObject({ role: "member", can_approve: false, can_record_payments: false, display_name: "Keith" });
  });

  it("strangers cannot see anything", async () => {
    expect((await stranger.from("households").select()).data).toEqual([]);
    expect((await stranger.rpc("claim_invites")).data).toBeNull();
    expect((await anon().from("rooms").select()).data).toEqual([]);
  });

  it("both homeowners can add items and options; children inherit the household", async () => {
    const r = await owner.from("rooms").insert({ household_id: hh, name: "Living & Coffee Bar" }).select().single();
    expect(r.error).toBeNull();
    room = r.data!.id;
    const i = await keith.from("required_items").insert({ household_id: hh, room_id: room, name: "Main sofa" }).select().single();
    expect(i.error).toBeNull();
    item = i.data!.id;
    const a = await owner.from("product_options").insert({ household_id: hh, required_item_id: item, title: "CassaHaus Lunavelle", price: 550, currency: "SGD", status: "shortlisted" }).select().single();
    const b = await keith.from("product_options").insert({ household_id: hh, required_item_id: item, title: "Globus China", price: 1462, status: "shortlisted" }).select().single();
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    optA = a.data!.id;
    optB = b.data!.id;
    expect(b.data!.currency).toBeNull(); // not assumed to be SGD
  });

  it("a stranger cannot attach rows to the household by guessing ids", async () => {
    const res = await stranger.from("product_options").insert({ household_id: hh, required_item_id: item, title: "Spam" });
    expect(res.error).not.toBeNull();
    const c = await stranger.from("option_comments").insert({ household_id: hh, option_id: optA, body: "hi" });
    expect(c.error).not.toBeNull();
  });

  it("Keith can comment and vote but not approve, pay, or change budgets", async () => {
    expect((await keith.from("option_comments").insert({ household_id: hh, option_id: optA, body: "Love the bouclé" })).error).toBeNull();
    expect((await keith.from("option_preferences").upsert({ household_id: hh, option_id: optA, vote: "love" })).error).toBeNull();

    const approve = await keith.rpc("approve_option", { p_option_id: optA });
    expect(approve.error?.message).toMatch(/permission to approve/);

    const sneaky = await keith.from("product_options").update({ status: "approved" }).eq("id", optA);
    expect(sneaky.error?.message).toMatch(/approval workflow/);

    const pay = await keith.from("payments").insert({ household_id: hh, kind: "deposit", amount: 10, currency: "SGD", fx_rate: 1, amount_sgd: 10, paid_on: "2026-11-06", required_item_id: item });
    expect(pay.error).not.toBeNull();

    const budget = await keith.from("households").update({ total_budget: 1 }).eq("id", hh).select();
    expect(budget.data ?? []).toEqual([]); // RLS hides the row from the update

    const allowance = await keith.from("required_items").update({ estimate_unit: 999 }).eq("id", item);
    expect(allowance.error?.message).toMatch(/permission to change budgets/);
  });

  it("Keith cannot grant himself permissions", async () => {
    const res = await keith.from("household_members").update({ can_approve: true }).eq("user_id", keithId);
    expect(res.error?.message).toMatch(/Only the owner/);
    expect((await keith.from("household_members").update({ display_name: "Keith L" }).eq("user_id", keithId)).error).toBeNull();
  });

  it("approval requires a confirmed currency", async () => {
    const r = await owner.rpc("approve_option", { p_option_id: optB });
    expect(r.error?.message).toMatch(/Confirm the price currency/);
  });

  let approvalA: string, approvalB: string;
  it("approving, paying a deposit, and switching never double counts", async () => {
    const a = await owner.rpc("approve_option", { p_option_id: optA });
    expect(a.error).toBeNull();
    approvalA = a.data!;
    const again = await owner.rpc("approve_option", { p_option_id: optA });
    expect(again.error?.message).toMatch(/already the approved choice/);

    const dep = await owner.from("payments").insert({ household_id: hh, approval_id: approvalA, kind: "deposit", amount: 100, currency: "SGD", fx_rate: 1, amount_sgd: 100, paid_on: "2026-11-06" }).select().single();
    expect(dep.error).toBeNull();
    expect(dep.data!.required_item_id).toBe(item); // filled from the approval
    expect(dep.data!.needs_reconciliation).toBe(false);

    const bad = await owner.from("payments").insert({ household_id: hh, approval_id: approvalA, kind: "deposit", amount: 100, currency: "CNY", fx_rate: 0.18, amount_sgd: 100, paid_on: "2026-11-06" });
    expect(bad.error?.message).toMatch(/check constraint/); // SGD amount must equal amount × rate

    // Confirm Globus currency as CNY and add a dated rate
    await owner.from("product_options").update({ currency: "CNY", freight_allowance: 80, freight_currency: "SGD" }).eq("id", optB);
    expect((await owner.from("exchange_rates").insert({ household_id: hh, currency: "CNY", rate_to_sgd: 0.185, as_of: "2026-11-06", source: "Manual (test)" })).error).toBeNull();
    const b = await owner.rpc("approve_option", { p_option_id: optB, p_note: "Switching to Globus" });
    expect(b.error).toBeNull();
    approvalB = b.data!;

    const { data: rows } = await owner.from("approvals").select().eq("required_item_id", item).order("approved_at");
    expect(rows!.map((r) => r.status)).toEqual(["superseded", "active"]);
    expect(rows![0].superseded_by).toBe(approvalB);
    expect(rows![1]).toMatchObject({ currency: "CNY", goods_sgd: 270.47, freight_sgd: 80, cost_sgd: 350.47, fx_source: "Manual (test)" });
    const { data: opts } = await owner.from("product_options").select("id,status").in("id", [optA, optB]);
    expect(Object.fromEntries(opts!.map((o) => [o.id, o.status]))).toEqual({ [optA]: "shortlisted", [optB]: "approved" });

    // A later rate change does not move the approved snapshot
    await owner.from("exchange_rates").insert({ household_id: hh, currency: "CNY", rate_to_sgd: 0.25, as_of: "2026-11-07", source: "Manual (test)" });
    const { data: snap } = await owner.from("approvals").select("cost_sgd").eq("id", approvalB).single();
    expect(snap!.cost_sgd).toBe(350.47);
  });

  it("the database refuses a second active approval for the same item", async () => {
    const res = await admin().from("approvals").update({ status: "active", ended_at: null }).eq("id", approvalA);
    expect(res.error?.message).toMatch(/approvals_one_active_idx|duplicate key/);
  });

  it("ordering with unresolved critical checks needs a documented override", async () => {
    await owner.from("option_checks").insert({ household_id: hh, option_id: optB, title: "Confirm lift access", critical: true });
    const blocked = await owner.rpc("mark_ordered", { p_approval_id: approvalB });
    expect(blocked.error?.message).toMatch(/critical check/);
    const ok = await owner.rpc("mark_ordered", { p_approval_id: approvalB, p_override_note: "Measured lift myself: 1.2 m door" });
    expect(ok.error).toBeNull();
    const switchAfterOrder = await owner.rpc("approve_option", { p_option_id: optA });
    expect(switchAfterOrder.error?.message).toMatch(/already been ordered/);
  });

  it("the owner can grant Keith approval rights later", async () => {
    expect((await owner.from("household_members").update({ can_approve: true }).eq("user_id", keithId)).error).toBeNull();
    const cancel = await keith.rpc("cancel_approval", { p_approval_id: approvalB, p_reason: "Supplier cannot deliver" });
    expect(cancel.error).toBeNull();
    const { data } = await owner.from("approvals").select("status").eq("id", approvalB).single();
    expect(data!.status).toBe("cancelled");
    await owner.from("household_members").update({ can_approve: false }).eq("user_id", keithId);
  });

  it("uploaded files are private to the household", async () => {
    const path = `${hh}/options/${optA}/test.png`;
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const up = await keith.storage.from("household-files").upload(path, png, { contentType: "image/png" });
    expect(up.error).toBeNull();
    // Owner can read; stranger and anonymous cannot
    expect((await owner.storage.from("household-files").download(path)).error).toBeNull();
    expect((await stranger.storage.from("household-files").download(path)).error).not.toBeNull();
    expect((await anon().storage.from("household-files").download(path)).error).not.toBeNull();
    const pub = anon().storage.from("household-files").getPublicUrl(path).data.publicUrl;
    expect((await fetch(pub)).status).toBeGreaterThanOrEqual(400);
    // Stranger cannot write into the household folder
    expect((await stranger.storage.from("household-files").upload(`${hh}/evil.png`, png, { contentType: "image/png" })).error).not.toBeNull();
    // Signed URLs work for members
    const signed = await owner.storage.from("household-files").createSignedUrl(path, 60);
    expect((await fetch(signed.data!.signedUrl)).status).toBe(200);
  });

  it("important actions are in the audit log with the actor", async () => {
    const { data } = await owner.from("audit_log").select("action,entity,actor_id").eq("entity", "approvals");
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.actor_id === ownerId || r.actor_id === keithId)).toBe(true);
    const keithComment = await owner.from("audit_log").select("actor_id").eq("entity", "option_comments").single();
    expect(keithComment.data!.actor_id).toBe(keithId);
  });
});
