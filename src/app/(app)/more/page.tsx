import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getContext, can } from "@/lib/context";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "More" };

export default async function MorePage() {
  const { member, email } = await getContext();
  const groups = [
    {
      title: "Decisions",
      links: [
        { href: "/more/approvals", label: "Approval history", text: "Every approval, switch and cancellation" },
        { href: "/more/warranties", label: "Warranties", text: "Coverage for approved and ordered items" },
      ],
    },
    {
      title: "Sourcing",
      links: [
        { href: "/trip", label: "Guangzhou & Foshan guide", text: "10–15 November 2026" },
        { href: "/more/suppliers", label: "Suppliers", text: "Shops, WeChat contacts and links" },
        { href: "/more/guide", label: "Sourcing guide", text: "China or Singapore, by category" },
      ],
    },
    {
      title: "Household",
      links: [
        { href: "/more/household", label: "People & permissions", text: member.role === "owner" ? "Invite Keith, change what he can do" : "Who can do what" },
        { href: "/more/activity", label: "Activity log", text: "Who changed what, and when" },
        ...(member.role === "owner" ? [{ href: "/more/import", label: "Import workbook", text: "Bring in your Excel tracker" }] : []),
        ...(can(member, "export") ? [{ href: "/api/export", label: "Export to Excel", text: "Backup of everything", download: true }] : []),
      ],
    },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="More" title="Settings & records" subtitle={`Signed in as ${email}`} />
      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <h2 className="eyebrow mb-2">{g.title}</h2>
          <div className="card divide-y hairline overflow-hidden">
            {g.links.map((l) =>
              "download" in l ? (
                <a key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-linen/50">
                  <span className="flex-1"><span className="block text-[15px]">{l.label}</span><span className="text-[12px] text-muted">{l.text}</span></span>
                  <ChevronRight className="h-4 w-4 text-taupe" />
                </a>
              ) : (
                <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-linen/50">
                  <span className="flex-1"><span className="block text-[15px]">{l.label}</span><span className="text-[12px] text-muted">{l.text}</span></span>
                  <ChevronRight className="h-4 w-4 text-taupe" />
                </Link>
              ),
            )}
          </div>
        </section>
      ))}
      <form action="/auth/signout" method="post" id="signout-form">
        <button className="btn btn-quiet w-full" data-signout>Sign out</button>
      </form>
    </div>
  );
}
