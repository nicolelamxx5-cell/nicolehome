import Link from "next/link";
import { getContext } from "@/lib/context";
import { PageHeader, EmptyState, Notice } from "@/components/ui";
import { TRI_LABEL } from "@/lib/labels";

export const metadata = { title: "Warranties" };

export default async function WarrantiesPage() {
  const { supabase, household } = await getContext();
  const { data: opts } = await supabase
    .from("product_options")
    .select("id, title, supplier_name, status, warranty_provided, warranty_duration, warranty_provider, warranty_valid_sg, warranty_local_service, warranty_parts, warranty_verified, warranty_coverage, required_items(name)")
    .eq("household_id", household.id)
    .in("status", ["approved", "ordered", "pending_confirmation", "shortlisted"])
    .order("status");
  const rows = opts ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/more", label: "More" }} eyebrow="Decisions" title="Warranties" />
      <Notice>“Claim” means the seller says so but you have not seen written terms. A China warranty does not guarantee repairs in Singapore.</Notice>
      {rows.length === 0 ? (
        <div className="mt-4"><EmptyState title="Nothing shortlisted yet" /></div>
      ) : (
        <ul className="card mt-4 divide-y hairline text-[14px]">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/options/${o.id}#warranty`} className="block px-4 py-3 hover:bg-linen/50">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{(o.required_items as unknown as { name: string })?.name} — {o.title}</span>
                  <span className="shrink-0 text-[12px] text-muted">{o.status === "approved" || o.status === "ordered" ? "Chosen" : "Candidate"}</span>
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  Warranty: {TRI_LABEL[o.warranty_provided]}
                  {o.warranty_duration && `, ${o.warranty_duration}`}
                  {o.warranty_provider && ` by ${o.warranty_provider}`}
                  {o.warranty_provided === "yes" && (o.warranty_verified ? " · terms seen" : " · claim only")} · Valid in SG: {TRI_LABEL[o.warranty_valid_sg]} · Local service: {TRI_LABEL[o.warranty_local_service]} · Parts: {TRI_LABEL[o.warranty_parts]}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
