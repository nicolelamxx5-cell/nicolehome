import "server-only";
import { cache } from "react";
import type { Ctx } from "@/lib/context";
import { signedUrls } from "@/lib/storage";
import { summarizeBudget, landedCost, latestRates, type OptionInput } from "@/lib/finance";

/** Everything the budget engine needs, in one round of parallel queries. */
export const loadBudget = cache(async (ctx: Ctx) => {
  const { supabase, household } = ctx;
  const hh = household.id;
  const [items, options, approvals, payments, shared, rates, rooms, categories] = await Promise.all([
    supabase.from("required_items").select("*").eq("household_id", hh),
    supabase
      .from("product_options")
      .select("id, required_item_id, status, price, currency, quantity, other_charges, freight_allowance, freight_currency, title")
      .eq("household_id", hh),
    supabase.from("approvals").select("*").eq("household_id", hh).order("approved_at"),
    supabase.from("payments").select("*").eq("household_id", hh).order("paid_on", { ascending: false }),
    supabase.from("shared_costs").select("*").eq("household_id", hh).order("created_at"),
    supabase.from("exchange_rates").select("*").eq("household_id", hh).order("as_of", { ascending: false }),
    supabase.from("rooms").select("*").eq("household_id", hh).order("sort_order"),
    supabase.from("budget_categories").select("*").eq("household_id", hh).order("sort_order"),
  ]);
  const summary = summarizeBudget({
    household,
    items: (items.data ?? []).map((i) => ({ ...i, quantity: String(i.quantity) })),
    options: (options.data ?? []) as OptionInput[],
    approvals: approvals.data ?? [],
    payments: payments.data ?? [],
    sharedCosts: (shared.data ?? []) as never,
    rates: rates.data ?? [],
  });
  return {
    summary,
    items: items.data ?? [],
    options: options.data ?? [],
    approvals: approvals.data ?? [],
    payments: payments.data ?? [],
    shared: shared.data ?? [],
    rates: rates.data ?? [],
    rateMap: latestRates(rates.data ?? []),
    rooms: rooms.data ?? [],
    categories: categories.data ?? [],
  };
});

/** First photo (thumbnail) for each option, as signed URLs. */
export async function coverImages(ctx: Ctx, optionIds: string[]) {
  const map = new Map<string, string>();
  if (optionIds.length === 0) return map;
  const { data } = await ctx.supabase
    .from("option_images")
    .select("option_id, storage_path, thumb_path, sort_order")
    .in("option_id", optionIds)
    .order("sort_order");
  const first = new Map<string, string>();
  for (const img of data ?? []) if (!first.has(img.option_id)) first.set(img.option_id, img.thumb_path ?? img.storage_path);
  const urls = await signedUrls(ctx.supabase, [...first.values()]);
  for (const [opt, path] of first) {
    const u = urls.get(path);
    if (u) map.set(opt, u);
  }
  return map;
}

export function describeLanded(o: OptionInput, rates: ReturnType<typeof latestRates>) {
  const c = landedCost(o, rates);
  if (c.ok) return { cents: c.total as number, note: null as string | null };
  const note =
    c.reason === "no_price"
      ? "No price yet"
      : c.reason === "currency_unknown"
        ? "Currency not confirmed"
        : c.reason === "freight_currency_unknown"
          ? "Freight currency not set"
          : `Needs a ${c.currency} exchange rate`;
  return { cents: null, note };
}
