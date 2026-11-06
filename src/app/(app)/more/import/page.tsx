import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { PageHeader, Notice, SectionTitle } from "@/components/ui";
import { ImportForm } from "./form";

export const metadata = { title: "Import workbook" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { supabase, household, member } = await getContext();
  if (member.role !== "owner") redirect("/more");
  const { data: batches } = await supabase.from("import_batches").select("*").eq("household_id", household.id).order("created_at", { ascending: false }).limit(5);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/more", label: "More" }} eyebrow="Household" title="Import your workbook" />
      {welcome && (
        <div className="mb-4">
          <Notice tone="ok">Your Home Hub is ready, with your rooms and the sofa comparison set up. Import your tracker to add every item — or skip this and add things as you go.</Notice>
        </div>
      )}
      <Notice>
        The app reads each room sheet’s ID, description, priority, source decision, quantity and estimate. Estimates become forecast allowances — they are never treated as payments or quotations. Formulas and macros are not copied; totals are recalculated here. After importing, the app becomes the main record; use Export for an Excel backup.
      </Notice>
      <div className="mt-4">
        <ImportForm />
      </div>
      {(batches ?? []).length > 0 && (
        <>
          <SectionTitle>Previous imports</SectionTitle>
          <ul className="card divide-y hairline text-[13px]">
            {(batches ?? []).map((b) => (
              <li key={b.id} className="px-4 py-2">
                {b.file_name} · {new Date(b.created_at).toLocaleString("en-SG")} · {Object.entries(b.summary as Record<string, number>).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-center">
        <Link href="/" className="text-[14px] text-muted underline underline-offset-4">Skip for now</Link>
      </p>
    </div>
  );
}
