import { redirect } from "next/navigation";
import { getUser } from "@/lib/context";
import { CreateHouseholdForm } from "./form";

export const metadata = { title: "Set up" };

export default async function SetupPage() {
  const { supabase, userId, email } = await getUser();
  const { data: member } = await supabase.from("household_members").select("household_id").eq("user_id", userId).maybeSingle();
  if (member) redirect("/");
  // Joining by invitation is idempotent, so it is safe to try on every visit.
  const { data: joined } = await supabase.rpc("claim_invites");
  if (joined) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="eyebrow">Welcome</div>
      <h1 className="font-display mt-1 text-4xl">Let’s set up your home</h1>
      <p className="mt-3 text-[15px] text-muted">
        If you are the main homeowner, create the household below. If you were invited (for example Keith), ask the owner to add
        <span className="font-medium text-ink"> {email}</span> under More → Household, then refresh this page.
      </p>
      <div className="card mt-8 p-6">
        <CreateHouseholdForm />
      </div>
      <form action="/auth/signout" method="post" className="mt-6 text-center">
        <button className="text-sm text-muted underline-offset-4 hover:underline">Sign out</button>
      </form>
    </main>
  );
}
