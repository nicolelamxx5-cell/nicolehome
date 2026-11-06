import Link from "next/link";
import { ChevronLeft, ImageIcon } from "lucide-react";
import { formatMoney, type Cents } from "@/lib/money";
import { OPTION_STATUS_LABEL } from "@/lib/labels";

export function PageHeader({
  eyebrow,
  title,
  back,
  children,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  back?: { href: string; label: string };
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 -ml-1 inline-flex items-center gap-1 text-sm text-muted hover:text-graphite">
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="font-display text-[2rem] leading-[1.1] text-graphite sm:text-[2.5rem]">{title}</h1>
          {subtitle && <div className="mt-2 text-[15px] text-muted">{subtitle}</div>}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Money({ cents, currency = "SGD", className = "" }: { cents: Cents | null | undefined; currency?: string; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(cents ?? null, currency)}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "bg-champagne/15 text-champagne-deep"
      : status === "ordered"
        ? "bg-sage/15 text-sage"
        : status === "cancelled"
          ? "bg-greige text-muted line-through"
          : status === "pending_confirmation"
            ? "bg-amber/10 text-amber"
            : "bg-linen text-ink";
  return <span className={`chip ${tone}`}>{OPTION_STATUS_LABEL[status] ?? status}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="font-display text-2xl">{title}</div>
      {children && <div className="mt-2 max-w-md text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-2xl">{children}</h2>
      {action}
    </div>
  );
}

/** Product photo, or a quiet placeholder. Never a stock or substitute image. */
export function Thumb({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-linen text-taupe ${className}`} aria-label={`${alt} (no photo yet)`}>
        <ImageIcon className="h-7 w-7" strokeWidth={1.25} />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- private signed URLs; Next image optimizer would re-host them
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-amber/30 bg-amber/5 text-ink"
      : tone === "danger"
        ? "border-rose/30 bg-rose/5 text-ink"
        : tone === "ok"
          ? "border-sage/30 bg-sage/5 text-ink"
          : "border-greige bg-linen/60 text-ink";
  return <div className={`rounded-2xl border px-4 py-3 text-[14px] leading-relaxed ${cls}`}>{children}</div>;
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    <div className="card h-full p-4 sm:p-5">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-[1.75rem] leading-none tabular-nums sm:text-[2rem]">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
