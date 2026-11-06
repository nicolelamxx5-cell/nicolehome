"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Heart, Wallet, Menu, Plus } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/shop", label: "Shop", icon: ShoppingBag, match: (p: string) => /^\/(shop|rooms|items|options|trip)/.test(p) },
  { href: "/wishlist", label: "Wishlist", icon: Heart, match: (p: string) => p.startsWith("/wishlist") },
  { href: "/budget", label: "Budget", icon: Wallet, match: (p: string) => p.startsWith("/budget") },
  { href: "/more", label: "More", icon: Menu, match: (p: string) => p.startsWith("/more") },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <>
      <Link
        href="/add"
        aria-label="Add product"
        className="fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-graphite text-ivory shadow-lg md:hidden"
        style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-6 w-6" strokeWidth={1.75} />
      </Link>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t hairline bg-paper/95 backdrop-blur md:hidden" aria-label="Main">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const active = t.match(path);
            const Icon = t.icon;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-graphite" : "text-stone"}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function SideNav({ householdName }: { householdName: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r hairline bg-paper px-5 py-8 md:flex">
      <Link href="/" className="mb-10 block">
        <div className="eyebrow">661C</div>
        <div className="font-display text-2xl leading-tight">{householdName}</div>
      </Link>
      <Link href="/add" className="btn btn-primary mb-8 w-full">
        <Plus className="h-4 w-4" /> Add product
      </Link>
      <ul className="space-y-1">
        {TABS.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${active ? "bg-linen text-graphite" : "text-ink hover:bg-linen/60"}`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
