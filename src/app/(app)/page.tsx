import Link from "next/link";
import { ArrowRight, Plane, Plus } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadBudget, coverImages } from "@/lib/queries";
import { Money, SectionTitle, Stat, Thumb, Notice, StatusPill } from "@/components/ui";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-SG", { hour: "numeric", hour12: false, timeZone: "Asia/Singapore" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const ctx = await getContext();
  const { member, household, supabase } = ctx;
  const data = await loadBudget(ctx);
  const s = data.summary;
  const itemsById = new Map(data.items.map((i) => [i.id, i]));

  const toDecide = s.items
    .filter((l) => !l.activeApprovalId && l.shortlistedCount >= 2)
    .map((l) => itemsById.get(l.itemId)!)
    .slice(0, 6);

  const { data: recent } = await supabase
    .from("product_options")
    .select("id, title, status, required_item_id, created_at")
    .eq("household_id", household.id)
    .order("created_at", { ascending: false })
    .limit(8);
  const covers = await coverImages(ctx, [...(recent ?? []).map((o) => o.id)]);
  const firstOptionByItem = new Map<string, string>();
  for (const o of data.options) if (!firstOptionByItem.has(o.required_item_id) && o.status !== "cancelled") firstOptionByItem.set(o.required_item_id, o.id);
  const decideCovers = await coverImages(ctx, toDecide.map((i) => firstOptionByItem.get(i.id)!).filter(Boolean));

  const review = data.items.filter((i) => i.needs_review && !i.is_archived).length;
  const today = new Date();
  const trip = household.trip_start ? new Date(household.trip_start + "T00:00:00+08:00") : null;
  const tripEnd = household.trip_end ? new Date(household.trip_end + "T23:59:59+08:00") : null;
  const daysToTrip = trip ? Math.ceil((trip.getTime() - today.getTime()) / 86_400_000) : null;
  const tripLive = trip && tripEnd && today >= trip && today <= tripEnd;
  const empty = data.items.length === 0;

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow">{household.name}</div>
        <h1 className="font-display mt-1 text-[2.25rem] leading-tight sm:text-5xl">
          {greeting()}, {member.display_name || "there"}
        </h1>
      </div>

      {empty && (
        <Notice>
          Your rooms are ready. {member.role === "owner" ? (
            <>
              <Link className="underline underline-offset-4" href="/more/import">Import your renovation workbook</Link> to bring in every item from your tracker, or{" "}
            </>
          ) : null}
          <Link className="underline underline-offset-4" href="/add">add your first product</Link>.
        </Notice>
      )}

      {(tripLive || (daysToTrip !== null && daysToTrip >= 0 && daysToTrip <= 60)) && (
        <Link href="/trip" className="card mt-4 flex items-center gap-4 p-5 transition hover:border-taupe">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linen">
            <Plane className="h-5 w-5 text-champagne-deep" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Guangzhou &amp; Foshan</div>
            <div className="font-display text-xl">
              {tripLive ? "You’re on the sourcing trip" : daysToTrip === 0 ? "The trip starts today" : `Trip starts in ${daysToTrip} day${daysToTrip === 1 ? "" : "s"}`}
            </div>
            <div className="text-[13px] text-muted">Open the destination checklists</div>
          </div>
          <ArrowRight className="h-5 w-5 text-stone" />
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Approved" value={<Money cents={s.approvedCommitments} />} hint="Committed choices" href="/budget" />
        <Stat label="Paid" value={<Money cents={s.actualPaid} />} hint="Confirmed payments" href="/budget/payments" />
        <div className="col-span-2 sm:col-span-1">
          <Stat
            label={s.totalBudget === null ? "Forecast" : "Left to commit"}
            value={<Money cents={s.totalBudget === null ? s.forecastFinalCost : s.remainingVsCommitted} />}
            hint={s.totalBudget === null ? "Set a total budget in Budget" : "Budget minus committed spend"}
            href="/budget"
          />
        </div>
      </div>

      {review > 0 && (
        <div className="mt-4">
          <Notice tone="warn">
            {review} imported item{review === 1 ? "" : "s"} may overlap with another row.{" "}
            <Link href="/shop?review=1" className="underline underline-offset-4">Review them</Link> so nothing is counted twice.
          </Notice>
        </div>
      )}

      <SectionTitle action={toDecide.length > 0 ? <Link href="/wishlist?status=shortlisted" className="text-sm text-muted">See all</Link> : undefined}>
        Ready to decide
      </SectionTitle>
      {toDecide.length === 0 ? (
        <p className="text-[15px] text-muted">When an item has two or more shortlisted options, it appears here for comparison.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {toDecide.map((item) => {
            const line = s.items.find((l) => l.itemId === item.id)!;
            return (
              <Link key={item.id} href={`/items/${item.id}/compare`} className="card flex items-center gap-4 p-3 transition hover:border-taupe">
                <Thumb src={decideCovers.get(firstOptionByItem.get(item.id) ?? "")} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="text-[13px] text-muted">{line.shortlistedCount} options to compare</div>
                </div>
                <ArrowRight className="h-4 w-4 text-stone" />
              </Link>
            );
          })}
        </div>
      )}

      <SectionTitle action={<Link href="/wishlist" className="text-sm text-muted">Wishlist</Link>}>Recently added</SectionTitle>
      {(recent ?? []).length === 0 ? (
        <Link href="/add" className="btn btn-quiet">
          <Plus className="h-4 w-4" /> Add a screenshot or link
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(recent ?? []).map((o) => (
            <Link key={o.id} href={`/options/${o.id}`} className="group">
              <Thumb src={covers.get(o.id)} alt={o.title} className="aspect-[4/5] w-full rounded-2xl" />
              <div className="mt-2 truncate text-[14px]">{o.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                <StatusPill status={o.status} />
                <span className="truncate">{itemsById.get(o.required_item_id)?.name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
