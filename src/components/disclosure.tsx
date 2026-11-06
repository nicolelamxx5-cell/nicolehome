"use client";
import { useState } from "react";

/** <details> that uses defaultOpen only on first render, then remembers the user's choice. */
export function Disclosure({ defaultOpen = false, summary, children, className = "", id }: { defaultOpen?: boolean; summary: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details id={id} className={className} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer">{summary}</summary>
      {children}
    </details>
  );
}
