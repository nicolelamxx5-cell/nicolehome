import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, Money, EmptyState } from "@/components/ui";
import { ItemRow } from "@/components/item-row";
import { NewItemForm } from "@/components/new-item-form";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "source", label: "To source" },
  { key: "compare", label: "Comparing" },
  { key: "approved", label: "Approved" },
];

export default async function RoomPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ f?: string }> }) {
  const { roomId } = await params;
  const { f = "all" } = await searchParams;
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const room = data.rooms.find((r) => r.id === roomId);
  if (!room) notFound();
  const lines = new Map(data.summary.items.map((l) => [l.itemId, l]));
  const all = data.items.filter((i) => i.room_id === roomId && !i.is_archived);
  const items = all.filter((i) => {
    const l = lines.get(i.id);
    if (f === "source") return !l?.activeApprovalId && (l?.optionCount ?? 0) === 0;
    if (f === "compare") return !l?.activeApprovalId && (l?.optionCount ?? 0) > 0;
    if (f === "approved") return !!l?.activeApprovalId;
    return true;
  });
  const approved = all.reduce((a, i) => a + (lines.get(i.id)?.approvedCost ?? 0), 0);
  const forecast = all.reduce((a, i) => a + (lines.get(i.id)?.forecast ?? 0), 0);

  return (
    <div>
      <PageHeader
        back={{ href: "/shop", label: "Rooms" }}
        eyebrow={room.is_whole_house ? "Whole home" : "Room"}
        title={room.name}
        subtitle={
          <span>
            Approved <Money cents={approved} /> · Forecast <Money cents={forecast} />
            {room.budget !== null && (
              <>
                {" "}
                · Budget <Money cents={Math.round(Number(room.budget) * 100)} />
              </>
            )}
          </span>
        }
      >
        <Link href={`/add?room=${room.id}`} className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" /> Add product
        </Link>
      </PageHeader>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={`/rooms/${roomId}${x.key === "all" ? "" : `?f=${x.key}`}`}
            className={`chip px-4 py-1.5 text-[13px] ${f === x.key ? "bg-graphite text-ivory" : ""}`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title={all.length === 0 ? "No items yet" : "Nothing here"}>
          {all.length === 0 ? "Add the things this room needs, or import your workbook from More → Import." : "Try another filter."}
        </EmptyState>
      ) : (
        <div className="card divide-y hairline overflow-hidden">
          {items.map((i) => (
            <ItemRow key={i.id} item={i} line={lines.get(i.id)} />
          ))}
        </div>
      )}

      <details className="card mt-6 p-4">
        <summary className="cursor-pointer text-[15px] font-medium">Add a required item to {room.name}</summary>
        <p className="mb-3 mt-2 text-[13px] text-muted">A required item is something the home needs (e.g. “Dining pendant light”). Products you find become options under it.</p>
        <NewItemForm roomId={room.id} />
      </details>
    </div>
  );
}
