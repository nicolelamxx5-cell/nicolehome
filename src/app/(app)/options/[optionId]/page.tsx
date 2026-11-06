import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getContext, can } from "@/lib/context";
import { loadBudget, describeLanded } from "@/lib/queries";
import { signedUrls } from "@/lib/storage";
import { PageHeader, Notice, SectionTitle, StatusPill, Money } from "@/components/ui";
import { ActionForm, ActionButton } from "@/components/action";
import { VoteBar, CheckRow, StatusSwitcher } from "@/components/option-widgets";
import { Gallery } from "@/components/gallery";
import { PhotoAdder } from "@/components/photo-adder";
import { SuggestionPanel } from "@/components/suggestion-panel";
import { Disclosure } from "@/components/disclosure";
import { addComment, deleteComment, updateOption, updateWarranty, approveOption, addCheck, deleteOption } from "@/app/actions";
import { PLATFORM_LABEL, PRICE_BASIS_LABEL, TRI_LABEL, VOTE_LABEL, CURRENCIES } from "@/lib/labels";
import { readiness, READINESS_LABEL } from "@/lib/requirements";
import { formatMoney, toCents } from "@/lib/money";
import type { OptionInput } from "@/lib/finance";
import { env } from "@/lib/env";

export default async function OptionPage({ params }: { params: Promise<{ optionId: string }> }) {
  const { optionId } = await params;
  const ctx = await getContext();
  const { supabase, member, userId, names, household } = ctx;
  const { data: o } = await supabase.from("product_options").select("*").eq("id", optionId).maybeSingle();
  if (!o) notFound();
  const [data, images, comments, prefs, checks] = await Promise.all([
    loadBudget(ctx),
    supabase.from("option_images").select("*").eq("option_id", optionId).order("sort_order"),
    supabase.from("option_comments").select("*").eq("option_id", optionId).order("created_at"),
    supabase.from("option_preferences").select("*").eq("option_id", optionId),
    supabase.from("option_checks").select("*").eq("option_id", optionId).order("critical", { ascending: false }).order("created_at"),
  ]);
  const item = data.items.find((i) => i.id === o.required_item_id)!;
  const urls = await signedUrls(supabase, (images.data ?? []).map((i) => i.storage_path));
  const photos = (images.data ?? []).map((i) => ({ id: i.id, src: urls.get(i.storage_path) ?? "" })).filter((p) => p.src);
  const landed = describeLanded(o as unknown as OptionInput, data.rateMap);
  const ready = readiness(checks.data ?? []);
  const unresolved = (checks.data ?? []).filter((c) => c.state === "pending" || c.state === "failed");
  const mine = (prefs.data ?? []).find((p) => p.user_id === userId)?.vote ?? null;
  const others = (prefs.data ?? []).filter((p) => p.user_id !== userId);
  const canApprove = can(member, "approve");
  const priceCents = toCents(o.price);
  const activeApproval = data.approvals.find((a) => a.required_item_id === item.id && a.status === "active");
  const approvedOther = activeApproval && activeApproval.option_id !== o.id ? activeApproval : null;

  const approveConfirm = [
    `Approve “${o.title}”?`,
    landed.cents !== null ? `Its cost (${formatMoney(landed.cents)}) will count as committed.` : "",
    approvedOther ? "This replaces the current approved choice — the old one stays on record but stops counting." : "",
    unresolved.length ? `${unresolved.length} purchase check(s) are still open and will be listed on the approval.` : "",
    o.price_basis === "observed" ? "The price is an unverified observation, not a quotation." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div>
      <PageHeader back={{ href: `/items/${item.id}`, label: item.name }} eyebrow={[o.supplier_name, PLATFORM_LABEL[o.platform]].filter(Boolean).join(" · ")} title={o.title}>
        <StatusPill status={o.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Gallery photos={photos} alt={o.title} canDelete />
          <div className="mt-3">
            <PhotoAdder householdId={household.id} optionId={o.id} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="eyebrow">Price as recorded</div>
            <div className="mt-1 font-display text-3xl tabular-nums" data-testid="option-price">
              {priceCents === null ? "No price yet" : o.currency ? formatMoney(priceCents, o.currency) : `${(priceCents / 100).toLocaleString("en-SG")} (currency not confirmed)`}
            </div>
            <div className="mt-1 text-[13px] text-muted">
              {PRICE_BASIS_LABEL[o.price_basis]}
              {Number(o.quantity) !== 1 && ` · × ${Number(o.quantity)}`}
            </div>
            <div className="mt-3 text-[14px]">
              Estimated landed cost: {landed.cents !== null ? <Money cents={landed.cents} className="font-medium" /> : <span className="text-amber">{landed.note}</span>}
            </div>
            {o.price_note && (
              <div className="mt-3">
                <Notice tone="warn">{o.price_note}</Notice>
              </div>
            )}
            {o.url && (
              <a href={o.url} target="_blank" rel="noreferrer noopener" className="btn btn-quiet btn-sm mt-4">
                <ExternalLink className="h-4 w-4" /> Open listing
              </a>
            )}
          </div>

          <div className="card p-5">
            <div className="eyebrow mb-3">Your preference</div>
            <VoteBar optionId={o.id} mine={mine} />
            {others.length > 0 && (
              <div className="mt-3 text-[14px] text-muted">
                {others.map((p) => `${names.get(p.user_id) ?? "Someone"}: ${VOTE_LABEL[p.vote]}`).join(" · ")}
              </div>
            )}
            <div className="mt-5 border-t hairline pt-4">
              <div className="eyebrow mb-3">Status</div>
              <StatusSwitcher optionId={o.id} status={o.status} />
            </div>
          </div>

          <div className="card p-5" data-testid="approve-panel">
            <div className="eyebrow">Decision</div>
            {o.status === "approved" || o.status === "ordered" ? (
              <p className="mt-2 text-[15px]">
                This is the approved choice for {item.name}.{" "}
                <Link href={`/items/${item.id}`} className="underline underline-offset-4">Manage the approval</Link>
              </p>
            ) : canApprove ? (
              <>
                <p className="mt-2 text-[14px] text-muted">
                  Readiness: <span className="text-ink">{READINESS_LABEL[ready]}</span>
                  {approvedOther && " · Another option is currently approved; approving this one replaces it."}
                </p>
                <div className="mt-3">
                  <ActionButton action={approveOption.bind(null, o.id)} className="btn btn-champagne" confirm={approveConfirm}>
                    {approvedOther ? "Approve instead" : "Approve this option"}
                  </ActionButton>
                </div>
              </>
            ) : (
              <p className="mt-2 text-[14px] text-muted">You can shortlist, vote and comment. The owner makes the final approval.</p>
            )}
          </div>
        </div>
      </div>

      <div id="comments" />
      <SectionTitle>Comments</SectionTitle>
      <div className="card p-5">
        {(comments.data ?? []).length === 0 && <p className="text-[14px] text-muted">No comments yet.</p>}
        <ul className="space-y-4">
          {(comments.data ?? []).map((c) => (
            <li key={c.id} data-testid="comment">
              <div className="text-[12px] text-muted">
                {names.get(c.user_id) ?? "Someone"} · {new Date(c.created_at).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </div>
              <div className="mt-1 whitespace-pre-line text-[15px]">{c.body}</div>
              {c.user_id === userId && (
                <ActionButton action={deleteComment.bind(null, c.id)} className="mt-1 text-[12px] text-muted underline-offset-4 hover:underline" confirm="Delete this comment?">
                  Delete
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={addComment.bind(null, o.id)} reset className="mt-4" submitLabel="Post comment" submitClass="btn btn-primary btn-sm">
          <label className="sr-only" htmlFor="comment-body">Comment</label>
          <textarea id="comment-body" name="body" className="field" placeholder="What do you think? e.g. Love the bouclé but is it deep enough?" required />
        </ActionForm>
      </div>

      <SectionTitle>
        Before ordering <span className="ml-2 align-middle text-[14px] font-normal text-muted">{READINESS_LABEL[ready]}</span>
      </SectionTitle>
      <div className="card overflow-hidden">
        {(checks.data ?? []).length === 0 && <p className="p-4 text-[14px] text-muted">No checks for this kind of item. Add your own below.</p>}
        <ul className="divide-y hairline">
          {(checks.data ?? []).map((c) => (
            <CheckRow key={c.id} check={c} resolvedBy={c.resolved_by ? names.get(c.resolved_by) : undefined} />
          ))}
        </ul>
        <div className="border-t hairline p-4">
          <ActionForm action={addCheck.bind(null, o.id)} reset submitLabel="Add check" submitClass="btn btn-quiet btn-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input name="title" className="field flex-1" placeholder="e.g. ID confirms ceiling support" aria-label="New check" />
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" name="critical" className="h-4 w-4 accent-graphite" /> Critical
              </label>
            </div>
          </ActionForm>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted">Checks are reminders to confirm with evidence. The app does not certify that a product meets Singapore regulations.</p>

      {env.aiEnabled && <SuggestionPanel optionId={o.id} suggestions={(o.ai_suggestions ?? null) as never} hasPhotos={photos.length > 0} />}

      <Disclosure
        className="card mt-10 p-5"
        defaultOpen={o.price === null || !o.currency}
        summary={
          <>
            <span className="font-display text-2xl">Details</span>
            <span className="ml-2 text-[13px] text-muted">price, size, material, supplier</span>
          </>
        }
      >
        <div className="mt-4">
        <ActionForm action={updateOption.bind(null, o.id)} submitLabel="Save details">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Product name" name="title" value={o.title} span />
            <F label="Link" name="url" value={o.url} type="url" span />
            <div>
              <label className="label" htmlFor="platform">Where it’s from</label>
              <select id="platform" name="platform" defaultValue={o.platform} className="field">
                {Object.entries(PLATFORM_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <F label="Supplier / shop" name="supplier_name" value={o.supplier_name} />
            <F label="WeChat / contact" name="contact" value={o.contact} />
            <F label="Model / SKU" name="model_sku" value={o.model_sku} />
            <div className="grid grid-cols-[1fr_7rem] gap-3 sm:col-span-2">
              <F label="Price (per unit)" name="price" value={o.price} type="number" />
              <div>
                <label className="label" htmlFor="currency">Currency</label>
                <select id="currency" name="currency" defaultValue={o.currency ?? ""} className="field">
                  <option value="">Not sure</option>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="price_basis">This price is…</label>
              <select id="price_basis" name="price_basis" defaultValue={o.price_basis} className="field">
                {Object.entries(PRICE_BASIS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <F label="Quantity" name="quantity" value={o.quantity} type="number" />
            <F label="Other charges (same currency)" name="other_charges" value={o.other_charges} type="number" />
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <F label="Freight / delivery allowance" name="freight_allowance" value={o.freight_allowance} type="number" />
              <div>
                <label className="label" htmlFor="freight_currency">Currency</label>
                <select id="freight_currency" name="freight_currency" defaultValue={o.freight_currency ?? "SGD"} className="field">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <F label="Price note" name="price_note" value={o.price_note} span />
            <F label="Dimensions" name="dimensions" value={o.dimensions} />
            <F label="Material" name="material" value={o.material} />
            <F label="Colour" name="colour" value={o.colour} />
            <F label="Configuration" name="configuration" value={o.configuration} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" name="description" defaultValue={o.description ?? ""} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" defaultValue={o.notes ?? ""} className="field" />
            </div>
          </div>
        </ActionForm>
        </div>
      </Disclosure>

      <Disclosure
        className="card mt-4 p-5"
        id="warranty"
        summary={
          <>
            <span className="font-display text-2xl">Warranty</span>
            <span className="ml-2 text-[13px] text-muted">
              {o.warranty_provided === "unknown" ? "not recorded yet" : `${TRI_LABEL[o.warranty_provided]}${o.warranty_duration ? `, ${o.warranty_duration}` : ""} · Singapore: ${TRI_LABEL[o.warranty_valid_sg]}`}
            </span>
          </>
        }
      >
        <div className="mt-4">
        {o.warranty_provided === "yes" && !o.warranty_verified && (
          <div className="mb-4">
            <Notice tone="warn">Warranty details are the supplier’s claim and have not been verified. A China warranty does not mean repairs are available in Singapore.</Notice>
          </div>
        )}
        <ActionForm action={updateWarranty.bind(null, o.id)} submitLabel="Save warranty">
          <div className="grid gap-4 sm:grid-cols-2">
            <Tri label="Warranty provided" name="warranty_provided" value={o.warranty_provided} />
            <F label="Duration" name="warranty_duration" value={o.warranty_duration} />
            <F label="Starts from" name="warranty_start_basis" value={o.warranty_start_basis} />
            <F label="Given by (supplier / manufacturer)" name="warranty_provider" value={o.warranty_provider} />
            <Tri label="Valid in Singapore" name="warranty_valid_sg" value={o.warranty_valid_sg} />
            <Tri label="Local servicing available" name="warranty_local_service" value={o.warranty_local_service} />
            <Tri label="Replacement parts available" name="warranty_parts" value={o.warranty_parts} />
            <F label="Coverage" name="warranty_coverage" value={o.warranty_coverage} span />
            <F label="Exclusions" name="warranty_exclusions" value={o.warranty_exclusions} span />
            <F label="Notes" name="warranty_notes" value={o.warranty_notes} span />
            <label className="flex items-center gap-2 text-[14px] sm:col-span-2">
              <input type="checkbox" name="warranty_verified" defaultChecked={o.warranty_verified} className="h-4 w-4 accent-graphite" />
              I have seen the written warranty terms (not just the seller’s claim)
            </label>
          </div>
        </ActionForm>
        <p className="mt-3 text-[12px] text-muted">
          Upload the warranty card or receipt as a photo above so it stays with this product.
        </p>
        </div>
      </Disclosure>

      <div className="mt-10 border-t hairline pt-6">
        <ActionButton action={deleteOption.bind(null, o.id)} className="btn btn-ghost btn-sm text-rose" confirm="Delete this option and its photos? This cannot be undone.">
          Delete option
        </ActionButton>
      </div>
    </div>
  );
}

function F({ label, name, value, type = "text", span }: { label: string; name: string; value: string | number | null; type?: string; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
        inputMode={type === "number" ? "decimal" : undefined}
        defaultValue={value ?? ""}
        className="field"
      />
    </div>
  );
}

function Tri({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value} className="field">
        <option value="unknown">Unknown / unconfirmed</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}
