import "server-only";
import type { Ctx } from "@/lib/context";
import { coverImages, describeLanded } from "@/lib/queries";
import { readiness, READINESS_LABEL } from "@/lib/requirements";
import type { OptionCardData } from "@/components/option-card";
import type { OptionInput, RateInput } from "@/lib/finance";
import type { Database } from "@/lib/database.types";

type Option = Database["public"]["Tables"]["product_options"]["Row"];

/** Decorate options with photos, landed cost, votes and readiness for cards. */
export async function cardData(ctx: Ctx, options: Option[], rates: Map<string, RateInput>): Promise<OptionCardData[]> {
  const ids = options.map((o) => o.id);
  if (ids.length === 0) return [];
  const [covers, prefs, checks, imgs] = await Promise.all([
    coverImages(ctx, ids),
    ctx.supabase.from("option_preferences").select("option_id, user_id, vote").in("option_id", ids),
    ctx.supabase.from("option_checks").select("option_id, state, critical").in("option_id", ids),
    ctx.supabase.from("option_images").select("option_id").in("option_id", ids),
  ]);
  return options.map((o) => {
    const landed = describeLanded(o as unknown as OptionInput, rates);
    const myChecks = (checks.data ?? []).filter((c) => c.option_id === o.id);
    return {
      id: o.id,
      title: o.title,
      status: o.status,
      supplier_name: o.supplier_name,
      platform: o.platform,
      price: o.price,
      currency: o.currency,
      price_basis: o.price_basis,
      landedCents: landed.cents,
      landedNote: landed.note,
      cover: covers.get(o.id),
      votes: (prefs.data ?? []).filter((p) => p.option_id === o.id).map((p) => ({ name: ctx.names.get(p.user_id) ?? "Someone", vote: p.vote })),
      readiness: myChecks.length ? READINESS_LABEL[readiness(myChecks)] : undefined,
      imageCount: (imgs.data ?? []).filter((i) => i.option_id === o.id).length,
    };
  });
}
