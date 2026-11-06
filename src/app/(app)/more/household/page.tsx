import { getContext } from "@/lib/context";
import { PageHeader, SectionTitle, Notice } from "@/components/ui";
import { ActionForm, ActionButton } from "@/components/action";
import { inviteMember, cancelInvite, updateMemberPermissions, updateMyName } from "@/app/actions";

export const metadata = { title: "People & permissions" };

const PERMS = [
  { key: "can_approve", label: "Approve purchases (final decision)" },
  { key: "can_record_payments", label: "Record payments" },
  { key: "can_edit_budget", label: "Change budgets and allowances" },
  { key: "can_export", label: "Export data" },
  { key: "can_manage_items", label: "Delete or archive others’ items and options" },
] as const;

export default async function HouseholdPage() {
  const { supabase, household, member, userId } = await getContext();
  const isOwner = member.role === "owner";
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("household_members").select("*").eq("household_id", household.id).order("role"),
    isOwner ? supabase.from("household_invites").select("*").eq("household_id", household.id).is("accepted_at", null) : Promise.resolve({ data: [] }),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/more", label: "More" }} eyebrow="Household" title="People & permissions" />
      <div className="card p-5">
        <ActionForm action={updateMyName} submitLabel="Save my name" submitClass="btn btn-quiet btn-sm">
          <label className="label" htmlFor="display_name">Your name (shown on comments and votes)</label>
          <input id="display_name" name="display_name" defaultValue={member.display_name} className="field" />
        </ActionForm>
      </div>

      <SectionTitle>Members</SectionTitle>
      <div className="space-y-3">
        {(members ?? []).map((m) => (
          <div key={m.user_id} className="card p-5" data-testid={`member-${m.display_name}`}>
            <div className="flex items-baseline justify-between">
              <div className="font-medium">{m.display_name || "Member"}{m.user_id === userId && " (you)"}</div>
              <div className="text-[13px] text-muted">{m.role === "owner" ? "Owner — full access" : "Member"}</div>
            </div>
            {m.role !== "owner" &&
              (isOwner ? (
                <ActionForm action={updateMemberPermissions.bind(null, m.user_id)} submitLabel="Save permissions" submitClass="btn btn-quiet btn-sm">
                  <p className="mt-2 text-[13px] text-muted">Members can always view everything, add screenshots and options, shortlist, vote and comment.</p>
                  <div className="mt-3 space-y-2">
                    {PERMS.map((p) => (
                      <label key={p.key} className="flex items-center gap-3 text-[14px]">
                        <input type="checkbox" name={p.key} defaultChecked={m[p.key]} className="h-4 w-4 accent-graphite" /> {p.label}
                      </label>
                    ))}
                  </div>
                </ActionForm>
              ) : (
                <ul className="mt-2 text-[13px] text-muted">
                  {PERMS.map((p) => (
                    <li key={p.key}>{m[p.key] ? "✓" : "—"} {p.label}</li>
                  ))}
                </ul>
              ))}
          </div>
        ))}
      </div>

      {isOwner && (
        <>
          <SectionTitle>Invite someone</SectionTitle>
          <div className="card p-5">
            <ActionForm action={inviteMember} reset submitLabel="Save invitation">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="inv-name">Name</label>
                  <input id="inv-name" name="display_name" className="field" placeholder="Keith" />
                </div>
                <div>
                  <label className="label" htmlFor="inv-email">Email</label>
                  <input id="inv-email" name="email" type="email" className="field" required />
                </div>
              </div>
              <p className="mt-3 text-[13px] text-muted">They join as a member who can view, add options, shortlist, vote and comment — not approve or pay. You can change this after they join.</p>
            </ActionForm>
            {(invites ?? []).length > 0 && (
              <ul className="mt-4 divide-y hairline border-t hairline text-[14px]">
                {(invites ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2">
                    <span>{i.display_name || i.email} <span className="text-muted">· {i.email} · waiting to sign up</span></span>
                    <ActionButton action={cancelInvite.bind(null, i.id)} className="text-[13px] text-muted underline">Cancel</ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4">
            <Notice>Once both of you have accounts, turn off new sign-ups in Supabase (Authentication → Providers → Email → “Allow new users to sign up”) so no one else can create an account. See docs/DEPLOYMENT.md.</Notice>
          </div>
        </>
      )}
    </div>
  );
}
