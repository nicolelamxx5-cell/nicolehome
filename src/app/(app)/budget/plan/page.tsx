import { redirect } from "next/navigation";
import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ActionForm } from "@/components/action";
import { saveBudgets } from "@/app/actions";

export const metadata = { title: "Set budgets" };

export default async function PlanPage() {
  const ctx = await getContext();
  if (!can(ctx.member, "budget")) redirect("/budget");
  const data = await loadBudget(ctx);
  const h = ctx.household;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/budget", label: "Budget" }} eyebrow="Budget" title="Set budgets" subtitle="All in SGD. Room and category budgets are optional guides." />
      <ActionForm action={saveBudgets} submitLabel="Save budgets">
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="total_budget">Total renovation budget (S$)</label>
            <input id="total_budget" name="total_budget" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={h.total_budget ?? ""} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="contingency">Contingency held back (S$)</label>
            <input id="contingency" name="contingency" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={h.contingency ?? 0} className="field" />
          </div>
        </div>
        <SectionTitle>Rooms</SectionTitle>
        <div className="card divide-y hairline">
          {data.rooms.map((r) => (
            <label key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="text-[15px]">{r.name}</span>
              <input name={`room:${r.id}`} type="number" step="0.01" min="0" inputMode="decimal" defaultValue={r.budget ?? ""} className="field w-36 text-right" aria-label={`${r.name} budget`} />
            </label>
          ))}
        </div>
        <SectionTitle>Categories</SectionTitle>
        <div className="card divide-y hairline">
          {data.categories.map((c) => (
            <label key={c.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="text-[15px]">{c.name}</span>
              <input name={`cat:${c.id}`} type="number" step="0.01" min="0" inputMode="decimal" defaultValue={c.budget ?? ""} className="field w-36 text-right" aria-label={`${c.name} budget`} />
            </label>
          ))}
        </div>
      </ActionForm>
    </div>
  );
}
