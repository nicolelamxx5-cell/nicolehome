"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/context";
import { seedHousehold, seedSofaComparison, linkTripLocations } from "@/lib/seed";

export type SetupState = { error?: string };

export async function createHousehold(_: SetupState, form: FormData): Promise<SetupState> {
  const parsed = z
    .object({ name: z.string().trim().min(1).max(120), displayName: z.string().trim().min(1, "Tell us your name").max(60) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await getUser();
  const { data: hh, error } = await supabase.rpc("create_household", { p_name: parsed.data.name, p_display_name: parsed.data.displayName });
  if (error || !hh) return { error: error?.message ?? "Could not create the household" };
  await seedHousehold(supabase, hh);
  await seedSofaComparison(supabase, hh);
  await linkTripLocations(supabase, hh);
  redirect("/more/import?welcome=1");
}
