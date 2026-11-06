import { getContext } from "@/lib/context";
import { CaptureFlow } from "@/components/capture-flow";
import { env } from "@/lib/env";

export const metadata = { title: "Add product" };

export default async function AddPage({ searchParams }: { searchParams: Promise<{ item?: string; room?: string; shared?: string; url?: string; title?: string; text?: string }> }) {
  const sp = await searchParams;
  const { supabase, household } = await getContext();
  const [{ data: rooms }, { data: items }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("household_id", household.id).order("sort_order"),
    supabase.from("required_items").select("id, name, room_id, legacy_id").eq("household_id", household.id).eq("is_archived", false).order("legacy_id", { nullsFirst: false }).order("name"),
  ]);
  const preItem = sp.item ? (items ?? []).find((i) => i.id === sp.item) : undefined;
  // Text shared from another app often contains the link inside it.
  const sharedUrl = sp.url || sp.text?.match(/https?:\/\/\S+/)?.[0];
  return (
    <CaptureFlow
      householdId={household.id}
      rooms={rooms ?? []}
      items={items ?? []}
      initialRoomId={preItem?.room_id ?? sp.room}
      initialItemId={preItem?.id}
      sharedUrl={sharedUrl}
      sharedTitle={sp.title}
      fromShare={sp.shared === "1"}
      aiEnabled={env.aiEnabled}
    />
  );
}
