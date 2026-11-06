"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/context";
import { previewImport, runImport } from "@/lib/import/apply";
import type { ImportIssue } from "@/lib/import/parse";
import { seedSofaComparison } from "@/lib/seed";

export type ImportReport = {
  ok: boolean;
  error?: string;
  dryRun?: boolean;
  summary?: Record<string, number>;
  issues?: ImportIssue[];
  conflicts?: { legacyId: string; field: string; appValue: unknown; workbookValue: unknown }[];
  rooms?: string[];
  sheets?: string[];
};

async function fileFrom(form: FormData) {
  const f = form.get("file");
  if (!(f instanceof File) || f.size === 0) throw new Error("Choose your workbook file (.xlsx or .xlsm)");
  if (!/\.(xlsx|xlsm)$/i.test(f.name)) throw new Error("Please choose an .xlsx or .xlsm file");
  if (f.size > 15 * 1024 * 1024) throw new Error("That file is larger than 15 MB");
  return f;
}

export async function importWorkbook(_: ImportReport | null, form: FormData): Promise<ImportReport> {
  try {
    const { supabase, household, member } = await getContext();
    if (member.role !== "owner") throw new Error("Only the owner can import");
    const file = await fileFrom(form);
    const buf = await file.arrayBuffer();
    if (form.get("mode") === "preview") {
      const { parsed, plan } = await previewImport(supabase, household.id, buf);
      return { ok: true, dryRun: true, summary: plan.summary, issues: plan.issues, conflicts: plan.conflicts, rooms: parsed.rooms.map((r) => r.name), sheets: parsed.sheetNames };
    }
    const plan = await runImport(supabase, household.id, buf, file.name);
    await seedSofaComparison(supabase, household.id); // re-links the sofa comparison to row 03-005 if needed
    revalidatePath("/", "layout");
    return { ok: true, dryRun: false, summary: plan.summary, issues: plan.issues, conflicts: plan.conflicts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
