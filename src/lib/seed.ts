import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { templatesFor } from "@/lib/requirements";

type DB = SupabaseClient<Database>;

/** Rooms as they appear in the homeowners' own workbook (sheet order). */
export const DEFAULT_ROOMS: { name: string; sheet: string; prefix: string; wholeHouse: boolean }[] = [
  { name: "Whole House", sheet: "Whole House", prefix: "01", wholeHouse: true },
  { name: "Entrance & Corridor", sheet: "Entrance & Corridor", prefix: "02", wholeHouse: false },
  { name: "Living & Coffee Bar", sheet: "Living & Coffee Bar", prefix: "03", wholeHouse: false },
  { name: "Dining", sheet: "Dining", prefix: "04", wholeHouse: false },
  { name: "Kitchen", sheet: "Kitchen", prefix: "05", wholeHouse: false },
  { name: "Yard & Laundry", sheet: "Yard & Laundry", prefix: "06", wholeHouse: false },
  { name: "Main Bedroom", sheet: "Main Bedroom", prefix: "07", wholeHouse: false },
  { name: "Bedroom 2", sheet: "Bedroom 2", prefix: "08", wholeHouse: false },
  { name: "Bedroom 3 / Flex", sheet: "Bedroom 3  Flex", prefix: "09", wholeHouse: false },
  { name: "Main Bathroom", sheet: "Main Bathroom", prefix: "10", wholeHouse: false },
  { name: "Common Bathroom", sheet: "Common Bathroom", prefix: "11", wholeHouse: false },
  { name: "Doors & Windows", sheet: "Doors & Windows", prefix: "12", wholeHouse: true },
  { name: "General Essentials", sheet: "General Essentials", prefix: "13", wholeHouse: true },
];

export const DEFAULT_CATEGORIES = [
  "ID / renovation contract",
  "Flooring & stone",
  "Carpentry",
  "Furniture",
  "Lighting",
  "Bathroom fittings",
  "Kitchen fittings",
  "Appliances",
  "Doors & hardware",
  "Curtains & soft furnishings",
  "Contingency",
];

/** Guangzhou / Foshan trip (10–15 Nov 2026). Names only — addresses are added once verified. */
export const TRIP_LOCATIONS = [
  { key: "china-ceramics-city", name_en: "China Ceramics City", name_zh: "中国陶瓷城", city: "Foshan", categories: ["tiles", "stone", "sanitary"] },
  { key: "ceramics-industry-hq", name_en: "China Ceramics Industry Headquarters", name_zh: "中国陶瓷产业总部基地", city: "Foshan", categories: ["tiles", "stone", "sanitary"] },
  { key: "huayi-expo", name_en: "Huayi International Decoration Expo City", name_zh: "华艺国际装饰博览城", city: "Foshan", categories: ["tiles", "stone", "sanitary", "hardware", "doors"] },
  { key: "huaxia-ceramics", name_en: "Huaxia Ceramics Expo City", name_zh: "华夏陶瓷博览城", city: "Foshan", categories: ["tiles", "stone", "sanitary"] },
  { key: "louvre-furniture", name_en: "Louvre International Furniture Exhibition Center", name_zh: "罗浮宫国际家居博览中心", city: "Foshan", categories: ["furniture", "lighting", "decor"] },
  { key: "sunlink-furniture", name_en: "Sunlink Furniture City", name_zh: "顺联家具城", city: "Foshan", categories: ["furniture", "decor"] },
  { key: "guzhen-lighting", name_en: "Guzhen lighting district", name_zh: "古镇灯饰市场", city: "Zhongshan", categories: ["lighting"] },
  { key: "tianhe-showrooms", name_en: "Tianhe appliance and home showrooms", name_zh: "天河家电家居展厅", city: "Guangzhou", categories: ["appliances", "decor"] },
];

export function itemTripCategories(i: { name: string; specification?: string | null; workbook_category?: string | null }): string[] {
  const t = `${i.name} ${i.specification ?? ""}`.toLowerCase();
  const c = (i.workbook_category ?? "").toLowerCase();
  const out: string[] = [];
  if (/\btiles?\b|flooring|skirting/.test(t) && !/^hack/.test(t)) out.push("tiles");
  if (/stone|sintered|countertop|marble/.test(t)) out.push("stone");
  if (/\bwc\b|basin|mixer|shower|towel|toilet|bathroom mirror|vanity/.test(t)) out.push("sanitary");
  if (c === "furniture" || /sofa|dining table|chair|stool|bed frame|headboard|coffee table|side table/.test(t)) out.push("furniture");
  if (c === "lighting" || /pendant|lamp|wall light/.test(t)) out.push("lighting");
  if (/handle|hardware|hinge|door stopper/.test(t)) out.push("hardware");
  if (/\bdoors?\b/.test(t) && !/main door|digital lock/.test(t)) out.push("doors");
  if (/rug|curtain|cushion|artwork|throw|mirror|bedding|linen/.test(t)) out.push("decor");
  if (c.startsWith("appliance")) out.push("appliances");
  return out;
}

export async function seedHousehold(supabase: DB, householdId: string) {
  await supabase.from("rooms").upsert(
    DEFAULT_ROOMS.map((r, i) => ({
      household_id: householdId,
      name: r.name,
      sort_order: i,
      source_sheet: r.sheet,
      legacy_prefix: r.prefix,
      is_whole_house: r.wholeHouse,
    })),
    { onConflict: "household_id,name", ignoreDuplicates: true },
  );
  await supabase.from("budget_categories").upsert(
    DEFAULT_CATEGORIES.map((name, i) => ({ household_id: householdId, name, sort_order: i })),
    { onConflict: "household_id,name", ignoreDuplicates: true },
  );
  await supabase.from("shopping_locations").upsert(
    TRIP_LOCATIONS.map((l, i) => ({
      household_id: householdId,
      key: l.key,
      name_en: l.name_en,
      name_zh: l.name_zh,
      city: l.city,
      categories: l.categories,
      sort_order: i,
      verification_note:
        l.city === "Zhongshan"
          ? "Guzhen is in Zhongshan, about 1–1.5 hours from Foshan — plan it as its own half day. Address not yet verified."
          : "Address not yet verified. Map links search by the Chinese name.",
    })),
    { onConflict: "household_id,key", ignoreDuplicates: true },
  );
  await supabase.from("households").update({ trip_start: "2026-11-10", trip_end: "2026-11-15", address: "661C Edgedale Plains" }).eq("id", householdId);
}

/** Link sourcing items to the trip destinations that sell them (no budget effect). */
export async function linkTripLocations(supabase: DB, householdId: string) {
  const [{ data: locs }, { data: items }] = await Promise.all([
    supabase.from("shopping_locations").select("id, categories").eq("household_id", householdId),
    supabase.from("required_items").select("id, name, specification, workbook_category, sourcing").eq("household_id", householdId).eq("is_archived", false),
  ]);
  const rows: { location_id: string; required_item_id: string; household_id: string }[] = [];
  for (const item of items ?? []) {
    if (item.sourcing === "singapore") continue;
    const cats = itemTripCategories(item);
    for (const l of locs ?? []) {
      if (l.categories.some((c) => cats.includes(c))) rows.push({ location_id: l.id, required_item_id: item.id, household_id: householdId });
    }
  }
  if (rows.length) await supabase.from("location_items").upsert(rows, { onConflict: "location_id,required_item_id", ignoreDuplicates: true });
  return rows.length;
}

export async function addLibraryChecks(supabase: DB, optionId: string, item: { name: string; specification?: string | null; workbook_category?: string | null }, householdId: string) {
  const templates = templatesFor(item);
  if (!templates.length) return 0;
  await supabase.from("option_checks").upsert(
    templates.map((t) => ({ household_id: householdId, option_id: optionId, template_key: t.key, title: t.title, detail: t.detail ?? null, critical: !!t.critical })),
    { onConflict: "option_id,template_key", ignoreDuplicates: true },
  );
  return templates.length;
}

/**
 * The first real comparison, from the homeowners' two sofa candidates. Prices
 * are recorded exactly as observed and flagged; nothing is approved; no photos
 * are added (the owner uploads their own screenshots).
 */
export async function seedSofaComparison(supabase: DB, householdId: string) {
  const { data: room } = await supabase.from("rooms").select("id").eq("household_id", householdId).eq("name", "Living & Coffee Bar").maybeSingle();
  if (!room) return;
  let { data: item } = await supabase.from("required_items").select("*").eq("household_id", householdId).eq("legacy_id", "03-005").maybeSingle();
  if (!item) {
    const existing = await supabase.from("required_items").select("*").eq("room_id", room.id).ilike("name", "main sofa").maybeSingle();
    item = existing.data;
  }
  if (!item) {
    const created = await supabase
      .from("required_items")
      .insert({
        household_id: householdId,
        room_id: room.id,
        name: "Main sofa",
        specification: "Cream upholstered sofa", // matches workbook row 03-005 so a later import links to it
        workbook_category: "Furniture",
        sourcing: "china",
        notes: "Sofa backs directly onto the coffee-bar island (3 stools on the island’s accessible side, none between sofa and island) — sofa depth matters.",
      })
      .select()
      .single();
    item = created.data;
  } else if (item.name !== "Main sofa") {
    await supabase
      .from("required_items")
      .update({
        name: "Main sofa",
        notes:
          item.notes ??
          "Sofa backs directly onto the coffee-bar island (3 stools on the island’s accessible side, none between sofa and island) — sofa depth matters.",
      })
      .eq("id", item.id);
  }
  if (!item) return;

  const suppliers = await supabase
    .from("suppliers")
    .upsert(
      [
        { household_id: householdId, name: "CassaHaus", platform: "website", shop_url: "https://cassahaus.com" },
        { household_id: householdId, name: "Globus China", platform: "website", shop_url: "https://globus-china.com" },
      ],
      { onConflict: "household_id,name", ignoreDuplicates: false },
    )
    .select();
  const sid = (n: string) => suppliers.data?.find((s) => s.name === n)?.id ?? null;

  const options = [
    {
      import_key: "seed:sofa-cassahaus",
      title: "Lunavelle Bouclé Sectional Sofa",
      supplier_name: "CassaHaus",
      supplier_id: sid("CassaHaus"),
      url: "https://cassahaus.com/products/lunavelle-boucle-sectional-sofa?variant=48818666471616",
      price: 550,
      currency: "SGD",
      price_basis: "observed" as const,
      price_note:
        "S$550 is the price first noted on the listing. It may be the starting price for a smaller configuration, not the sofa pictured. Confirm the exact configuration, dimensions and price.",
    },
    {
      import_key: "seed:sofa-globus",
      title: "Globus China sofa (listing 174015)",
      supplier_name: "Globus China",
      supplier_id: sid("Globus China"),
      url: "https://globus-china.com/products/174015",
      price: 1462,
      currency: null,
      price_basis: "observed" as const,
      price_note:
        "Recorded as “$1,462”. The currency is not confirmed — it has not been assumed to be SGD. Confirm the currency, configuration, dimensions and final landed cost.",
    },
  ];
  for (const o of options) {
    const { data: existing } = await supabase.from("product_options").select("id").eq("household_id", householdId).eq("import_key", o.import_key).maybeSingle();
    if (existing) continue;
    const { data: created } = await supabase
      .from("product_options")
      .insert({ ...o, household_id: householdId, required_item_id: item.id, platform: "website", status: "shortlisted", quantity: 1 })
      .select("id")
      .single();
    if (created) await addLibraryChecks(supabase, created.id, { name: "Main sofa", specification: item.specification, workbook_category: "Furniture" }, householdId);
  }
}
