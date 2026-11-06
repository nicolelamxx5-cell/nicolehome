import { getContext } from "@/lib/context";
import { PageHeader, SectionTitle, Notice } from "@/components/ui";

export const metadata = { title: "Sourcing guide" };

const DEFAULTS = [
  { pref: "Usually China", items: "Decorative lighting, unique furniture, stone and tiles, bathroom accessories, decorative hardware, custom furnishings, special design items" },
  { pref: "Usually Singapore", items: "Air-conditioning, major appliances that depend on servicing, products needing reliable local servicing, standard ceiling fans where local warranty matters" },
  { pref: "Compare both", items: "Water purifiers, toilet bowls, taps and shower fittings, special ceiling fans, other technically sensitive products" },
];

export default async function GuidePage() {
  const { supabase, household } = await getContext();
  const { data: rows } = await supabase.from("sourcing_guidelines").select("*").eq("household_id", household.id).order("sort_order");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={{ href: "/shop", label: "Shop" }} eyebrow="Sourcing" title="China or Singapore?" />
      <Notice>These are starting preferences, not decisions. Each item keeps its own recommendation, which you can change.</Notice>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {DEFAULTS.map((d) => (
          <div key={d.pref} className="card p-4">
            <div className="font-display text-xl">{d.pref}</div>
            <p className="mt-1 text-[13px] text-muted">{d.items}</p>
          </div>
        ))}
      </div>
      <SectionTitle>From your workbook</SectionTitle>
      {(rows ?? []).length === 0 ? (
        <p className="text-[14px] text-muted">Import your workbook to bring in its Sourcing Guide sheet.</p>
      ) : (
        <ul className="card divide-y hairline text-[14px]">
          {(rows ?? []).map((g) => (
            <li key={g.id} className="px-4 py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{g.category}</span>
                <span className="text-right text-champagne-deep">{g.preferred}</span>
              </div>
              {g.rationale && <div className="text-[13px] text-muted">{g.rationale}</div>}
              {g.important_check && <div className="mt-1 text-[13px]">Check: {g.important_check}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
