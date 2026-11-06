import { getContext } from "@/lib/context";
import { BottomNav, SideNav } from "@/components/nav";
import { OfflineBanner } from "@/components/offline-banner";
import { QueueStatus } from "@/components/queue-status";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { household } = await getContext();
  return (
    <div className="flex min-h-dvh">
      <SideNav householdName={household.name} />
      <div className="min-w-0 flex-1">
        <OfflineBanner />
        <QueueStatus />
        <main className="mx-auto w-full max-w-5xl px-4 pb-36 pt-6 sm:px-6 md:pb-16 md:pt-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
