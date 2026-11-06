import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ItemLine } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { SOURCING_LABEL } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Item = Database["public"]["Tables"]["required_items"]["Row"];

export function itemState(line?: ItemLine): { label: string; tone: string } {
  if (!line) return { label: "To source", tone: "text-muted" };
  if (line.activeApprovalId) {
    if (line.outstanding === 0 && line.approvedCost > 0) return { label: "Approved · paid", tone: "text-sage" };
    return { label: "Approved", tone: "text-champagne-deep" };
  }
  if (line.shortlistedCount >= 2) return { label: `${line.shortlistedCount} to compare`, tone: "text-ink" };
  if (line.optionCount > 0) return { label: `${line.optionCount} option${line.optionCount === 1 ? "" : "s"}`, tone: "text-ink" };
  return { label: "To source", tone: "text-muted" };
}

export function ItemRow({ item, line, roomName }: { item: Item; line?: ItemLine; roomName?: string }) {
  const st = itemState(line);
  const amount = line?.activeApprovalId ? line.approvedCost : line?.allowance ?? null;
  return (
    <Link href={`/items/${item.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-linen/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] font-medium">{item.name}</span>
          {item.needs_review && <span className="chip bg-amber/10 text-amber">Review</span>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted">
          {[item.legacy_id, roomName, item.workbook_category, item.sourcing !== "undecided" ? SOURCING_LABEL[item.sourcing] : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-[13px] ${st.tone}`}>{st.label}</div>
        {amount !== null && amount > 0 && (
          <div className="text-[12px] tabular-nums text-muted">
            {line?.activeApprovalId ? "" : "≈ "}
            {formatMoney(amount)}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-taupe" />
    </Link>
  );
}
