import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, can } from "@/lib/context";
import { loadBudget, describeLanded } from "@/lib/queries";
import { signedUrls } from "@/lib/storage";
import { PageHeader, Thumb, StatusPill, EmptyState, Notice } from "@/components/ui";
import { ActionButton } from "@/components/action";
import { approveOption } from "@/app/actions";
import { formatMoney, toCents } from "@/lib/money";
import { PLATFORM_LABEL, PRICE_BASIS_LABEL, TRI_LABEL, VOTE_LABEL } from "@/lib/labels";
import { readiness, READINESS_LABEL } from "@/lib/requirements";
import type { OptionInput } from "@/lib/finance";

export const metadata = { title: "Compare" };

export default async function ComparePage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await getContext();
  const { supabase, names, member } = ctx;
  const data = await loadBudget(ctx);
  const item = data.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const { data: options } = await supabase
    .from("product_options")
    .select("*")
    .eq("required_item_id", itemId)
    .neq("status", "cancelled")
    .order("created_at");
  const opts = options ?? [];
  const ids = opts.map((o) => o.id);
  const [imgs, prefs, checks, comments, members] = await Promise.all([
    supabase.from("option_images").select("option_id, storage_path, sort_order").in("option_id", ids).order("sort_order"),
    supabase.from("option_preferences").select("option_id, user_id, vote").in("option_id", ids),
    supabase.from("option_checks").select("option_id, state, critical, title").in("option_id", ids),
    supabase.from("option_comments").select("option_id").in("option_id", ids),
    supabase.from("household_members").select("user_id, display_name, role").eq("household_id", ctx.household.id).order("role"),
  ]);
  const firstImg = new Map<string, string>();
  for (const i of imgs.data ?? []) if (!firstImg.has(i.option_id)) firstImg.set(i.option_id, i.storage_path);
  const urls = await signedUrls(supabase, [...firstImg.values()]);
  const canApprove = can(member, "approve");
  const active = data.approvals.find((a) => a.required_item_id === itemId && a.status === "active");

  const cols = opts.map((o) => {
    const landed = describeLanded(o as unknown as OptionInput, data.rateMap);
    const myChecks = (checks.data ?? []).filter((c) => c.option_id === o.id);
    const open = myChecks.filter((c) => c.state === "pending" || c.state === "failed");
    const price = toCents(o.price);
    return {
      o,
      photo: urls.get(firstImg.get(o.id) ?? ""),
      landed,
      ready: myChecks.length ? READINESS_LABEL[readiness(myChecks)] : "No checks",
      openChecks: open,
      priceText: price === null ? "—" : o.currency ? formatMoney(price, o.currency) : `${(price / 100).toLocaleString("en-SG")} (currency?)`,
      votes: (members.data ?? []).map((m) => ({
        name: m.display_name || names.get(m.user_id) || "Member",
        vote: (prefs.data ?? []).find((p) => p.option_id === o.id && p.user_id === m.user_id)?.vote,
      })),
      comments: (comments.data ?? []).filter((c) => c.option_id === o.id).length,
    };
  });

  const rows: { label: string; render: (c: (typeof cols)[number]) => React.ReactNode }[] = [
    { label: "Supplier", render: (c) => c.o.supplier_name ?? "—" },
    { label: "Source", render: (c) => PLATFORM_LABEL[c.o.platform] ?? c.o.platform },
    { label: "Price", render: (c) => <span className="tabular-nums">{c.priceText}</span> },
    { label: "Price basis", render: (c) => <span className={c.o.price_basis === "observed" ? "text-amber" : ""}>{PRICE_BASIS_LABEL[c.o.price_basis]}</span> },
    { label: "Quantity", render: (c) => Number(c.o.quantity) },
    { label: "Delivery / freight", render: (c) => (c.o.freight_allowance ? formatMoney(toCents(c.o.freight_allowance), c.o.freight_currency ?? "SGD") : "—") },
    { label: "Est. landed (SGD)", render: (c) => (c.landed.cents !== null ? <span className="font-medium tabular-nums">{formatMoney(c.landed.cents)}</span> : <span className="text-amber">{c.landed.note}</span>) },
    { label: "Dimensions", render: (c) => c.o.dimensions ?? <span className="text-amber">Not confirmed</span> },
    { label: "Material", render: (c) => c.o.material ?? "—" },
    { label: "Colour", render: (c) => c.o.colour ?? "—" },
    { label: "Configuration", render: (c) => c.o.configuration ?? "—" },
    {
      label: "Warranty",
      render: (c) =>
        c.o.warranty_provided === "unknown" ? (
          <span className="text-muted">Unknown</span>
        ) : (
          <span>
            {TRI_LABEL[c.o.warranty_provided]}
            {c.o.warranty_duration && `, ${c.o.warranty_duration}`} · SG: {TRI_LABEL[c.o.warranty_valid_sg]}
            {!c.o.warranty_verified && c.o.warranty_provided === "yes" && <span className="text-amber"> (claim)</span>}
          </span>
        ),
    },
    {
      label: "Before ordering",
      render: (c) => (
        <span>
          {c.ready}
          {c.openChecks.length > 0 && <span className="block text-[12px] text-muted">{c.openChecks.length} open check{c.openChecks.length === 1 ? "" : "s"}</span>}
        </span>
      ),
    },
    ...(members.data ?? []).map((m, idx) => ({
      label: `${m.display_name || "Member"}’s view`,
      render: (c: (typeof cols)[number]) => {
        const v = c.votes[idx]?.vote;
        return v ? VOTE_LABEL[v] : <span className="text-muted">No vote</span>;
      },
    })),
    { label: "Comments", render: (c) => <Link href={`/options/${c.o.id}#comments`} className="underline underline-offset-4">{c.comments}</Link> },
  ];

  const approveCell = (c: (typeof cols)[number]) =>
    c.o.status === "approved" || c.o.status === "ordered" ? (
      <span className="chip bg-champagne/15 text-champagne-deep">Current choice</span>
    ) : canApprove ? (
      <ActionButton
        action={approveOption.bind(null, c.o.id)}
        className="btn btn-champagne btn-sm"
        confirm={`Approve “${c.o.title}”?${active ? " This replaces the current choice (it stays on record)." : ""}${c.openChecks.length ? ` ${c.openChecks.length} check(s) are still open.` : ""}`}
      >
        {active ? "Approve instead" : "Approve"}
      </ActionButton>
    ) : null;

  return (
    <div>
      <PageHeader back={{ href: `/items/${itemId}`, label: item.name }} eyebrow="Compare" title={item.name} subtitle={`${cols.length} options side by side`} />
      {cols.length < 2 ? (
        <EmptyState title="Add another option to compare" action={<Link href={`/add?item=${itemId}`} className="btn btn-primary">Add option</Link>} />
      ) : (
        <>
          {cols.some((c) => c.o.price_basis === "observed") && (
            <div className="mb-4">
              <Notice tone="warn">Some prices were noted from a listing and are not quotations. Confirm configuration and final price before approving.</Notice>
            </div>
          )}
          {/* Mobile: swipe between full cards */}
          <div className="snap-row no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:hidden" data-testid="compare-cards">
            {cols.map((c) => (
              <article key={c.o.id} className="card w-[85%] shrink-0 overflow-hidden">
                <Link href={`/options/${c.o.id}`}>
                  <Thumb src={c.photo} alt={c.o.title} className="aspect-square w-full" />
                </Link>
                <div className="p-4">
                  <StatusPill status={c.o.status} />
                  <h3 className="mt-2 font-medium leading-snug">{c.o.title}</h3>
                  <dl className="mt-3 space-y-2 text-[14px]">
                    {rows.map((r) => (
                      <div key={r.label} className="flex justify-between gap-3 border-b hairline pb-2 last:border-0">
                        <dt className="shrink-0 text-muted">{r.label}</dt>
                        <dd className="text-right">{r.render(c)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4">{approveCell(c)}</div>
                </div>
              </article>
            ))}
          </div>
          <p className="text-center text-[12px] text-muted md:hidden">Swipe to see each option</p>

          {/* Desktop: side-by-side table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full table-fixed text-[14px]" data-testid="compare-table">
              <thead>
                <tr>
                  <th className="w-44 p-4" />
                  {cols.map((c) => (
                    <th key={c.o.id} className="p-4 text-left align-top font-normal">
                      <Link href={`/options/${c.o.id}`} className="block">
                        <Thumb src={c.photo} alt={c.o.title} className="aspect-[4/3] w-full rounded-xl" />
                        <div className="mt-3 font-medium leading-snug">{c.o.title}</div>
                      </Link>
                      <div className="mt-2">
                        <StatusPill status={c.o.status} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t hairline">
                    <th className="p-4 text-left align-top font-normal text-muted">{r.label}</th>
                    {cols.map((c) => (
                      <td key={c.o.id} className="p-4 align-top">{r.render(c)}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t hairline">
                  <th className="p-4" />
                  {cols.map((c) => (
                    <td key={c.o.id} className="p-4">{approveCell(c)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
