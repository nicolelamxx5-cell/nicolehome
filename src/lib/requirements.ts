// Rules-based "check before ordering" library. These are things to confirm
// with evidence. The app never claims a product is compliant on its own.

export type CheckState = "pending" | "confirmed" | "not_applicable" | "failed";
export type Readiness = "ready" | "pending" | "do_not_order";

export interface CheckTemplate {
  key: string;
  title: string;
  detail?: string;
  critical?: boolean;
}

export interface RequirementGroup {
  id: string;
  label: string;
  match: (t: { name: string; specification?: string | null; workbook_category?: string | null }) => boolean;
  checks: CheckTemplate[];
}

const has = (re: RegExp) => (t: { name: string; specification?: string | null; workbook_category?: string | null }) =>
  re.test(`${t.name} ${t.specification ?? ""}`.toLowerCase());
const cat = (re: RegExp) => (t: { workbook_category?: string | null }) => re.test((t.workbook_category ?? "").toLowerCase());

export const REQUIREMENT_GROUPS: RequirementGroup[] = [
  {
    id: "sofa",
    label: "Sofa",
    match: has(/sofa|sectional|couch/),
    checks: [
      { key: "sofa.dimensions", title: "Confirm exact dimensions (width, depth, seat and back height) of the configuration being bought", critical: true },
      { key: "sofa.chaise", title: "Confirm chaise orientation (left- or right-hand facing, as seen when facing the sofa)", critical: true },
      { key: "sofa.layout", title: "Check fit with the living-room layout: the sofa backs directly onto the coffee-bar island, so its depth sets the walkway", detail: "Island stools are on the accessible side only; there are no stools between the sofa and the island.", critical: true },
      { key: "sofa.access", title: "Check it fits through the HDB lift, the main door and any corridor turns (or arrives in modules)", critical: true },
      { key: "sofa.fabric", title: "Confirm upholstery material, rub-count/durability and cleaning instructions (removable covers?)" },
      { key: "sofa.frame", title: "Confirm frame construction and cushion filling / density" },
      { key: "sofa.warranty", title: "Confirm warranty and after-sales coverage that applies in Singapore" },
      { key: "sofa.price", title: "Confirm final price and currency for this exact configuration", critical: true },
    ],
  },
  {
    id: "lighting",
    label: "Lighting",
    match: (t) => cat(/lighting/)(t) || has(/pendant|lamp|downlight|led strip|wall light|ceiling light|task light/)(t),
    checks: [
      { key: "light.voltage", title: "Rated for Singapore supply: 230 V, 50 Hz", critical: true },
      { key: "light.safety", title: "Ask the ID/electrician whether this fitting or its driver must carry a Singapore Safety Mark, and get evidence if so", critical: true },
      { key: "light.cct", title: "Colour temperature is neutral white (about 4000K), not warm yellow", detail: "Homeowner preference." },
      { key: "light.driver", title: "Replacement driver / bulb type available in Singapore" },
      { key: "light.mounting", title: "Mounting dimensions and weight recorded" },
      { key: "light.ceiling", title: "ID confirms ceiling support / false-ceiling reinforcement", critical: true },
    ],
  },
  {
    id: "toilet",
    label: "Toilet bowl",
    match: has(/\bwc\b|toilet bowl|water closet|flush system/),
    checks: [
      { key: "wc.trap", title: "S-trap or P-trap matches the existing outlet", critical: true },
      { key: "wc.roughin", title: "Rough-in (wall to outlet centre) measured on site and matches", critical: true },
      { key: "wc.pub", title: "Check PUB requirements and WELS registration/rating for this exact model; keep the evidence", critical: true },
      { key: "wc.parts", title: "Flush fittings and spare parts obtainable in Singapore" },
      { key: "wc.id", title: "ID / plumber confirms installation", critical: true },
    ],
  },
  {
    id: "taps",
    label: "Taps & shower fittings",
    match: has(/\btap\b|mixer|faucet|rain shower|shower mixer|basin mixer/),
    checks: [
      { key: "tap.pub", title: "Check PUB requirements and WELS registration for this exact model; keep the evidence", critical: true },
      { key: "tap.plumbing", title: "Thread sizes and connections compatible with Singapore plumbing", critical: true },
      { key: "tap.concealed", title: "Concealed body (if any) is compatible with the trim set being bought" },
      { key: "tap.pressure", title: "Suitable for the home's water pressure (check with plumber)" },
      { key: "tap.cartridge", title: "Spare cartridges obtainable" },
    ],
  },
  {
    id: "flooring",
    label: "Tiles & flooring",
    match: (t) => has(/\btiles?\b|tiling|flooring|skirting/)(t) && !has(/^hack/)(t),
    checks: [
      { key: "tile.slip", title: "Slip-resistance rating suitable for the area (wet areas need higher resistance)", critical: true },
      { key: "tile.finish", title: "Surface finish confirmed (matt / honed / polished) from a physical sample" },
      { key: "tile.size", title: "Tile dimensions and thickness confirmed" },
      { key: "tile.batch", title: "Shade/batch consistency — order the whole quantity from one batch" },
      { key: "tile.spare", title: "Spare quantity (wastage + future repairs) included" },
      { key: "tile.id", title: "ID confirms quantities, layout and laying method", critical: true },
    ],
  },
  {
    id: "stone",
    label: "Stone / sintered stone",
    match: has(/stone|sintered|countertop|marble|quartz|backsplash/),
    checks: [
      { key: "stone.type", title: "Actual material type confirmed (natural stone, sintered stone, quartz, porcelain slab)", critical: true },
      { key: "stone.thickness", title: "Thickness confirmed" },
      { key: "stone.slab", title: "Slab dimensions cover the run without unplanned joints" },
      { key: "stone.edges", title: "Edge profiles agreed" },
      { key: "stone.cutouts", title: "Cut-outs (sink, hob, tap) dimensions from final appliance models", critical: true },
      { key: "stone.care", title: "Sealing and maintenance requirements understood" },
      { key: "stone.fabrication", title: "Who fabricates and installs is agreed (China supplier vs Singapore installer)", critical: true },
    ],
  },
  {
    id: "water",
    label: "Water purifier / dispenser",
    match: has(/purifier|water dispenser|water filter/),
    checks: [
      { key: "water.filters", title: "Replacement filters obtainable in Singapore", critical: true },
      { key: "water.cost", title: "Yearly consumable cost recorded" },
      { key: "water.service", title: "Servicing available in Singapore" },
      { key: "water.plumbing", title: "Plumbing connection compatible", critical: true },
      { key: "water.power", title: "Power requirements: 230 V, Singapore plug" },
      { key: "water.drinking", title: "Suitable for drinking water (certification evidence)" },
    ],
  },
  {
    id: "appliance",
    label: "Appliance",
    match: (t) =>
      cat(/appliance/)(t) ||
      has(/refrigerator|fridge|oven|\bhob\b|hood|dishwasher|washing machine|dryer|television|soundbar|coffee machine|water heater|aircon|air-conditioning/)(t),
    checks: [
      { key: "app.warranty", title: "Singapore warranty and servicing confirmed", critical: true },
      { key: "app.voltage", title: "Rated for 230 V / 50 Hz", critical: true },
      { key: "app.plug", title: "Singapore plug (Type G) or hard-wired by a licensed electrician" },
      { key: "app.dims", title: "Dimensions match the cabinet/space (send final model to ID/ARCFORM)", critical: true },
      { key: "app.clearance", title: "Ventilation and installation clearances met" },
      { key: "app.water", title: "Water and drain connections (if any) confirmed" },
    ],
  },
  {
    id: "carpentry",
    label: "Carpentry",
    match: (t) => cat(/carpentry/)(t) || has(/wardrobe|cabinet|carpentry|vanity/)(t),
    checks: [
      { key: "carp.measure", title: "Based on actual site measurements", critical: true },
      { key: "carp.drawings", title: "Fabrication drawings approved", critical: true },
      { key: "carp.appliances", title: "Built-in appliance dimensions locked before production" },
      { key: "carp.hardware", title: "Hinge/runner brand and soft-close confirmed" },
    ],
  },
  {
    id: "glass",
    label: "Glass & screens",
    match: has(/glass|shower screen/),
    checks: [
      { key: "glass.safety", title: "Tempered/safety glass specification confirmed", critical: true },
      { key: "glass.measure", title: "Site-measured by the installer", critical: true },
      { key: "glass.installer", title: "Singapore installer agreed" },
    ],
  },
  {
    id: "electrical",
    label: "Switches & sockets",
    match: has(/switch|socket|smart switch/),
    checks: [
      { key: "elec.safety", title: "Ask the licensed electrician whether a Singapore Safety Mark is required, and get evidence", critical: true },
      { key: "elec.fit", title: "Fits Singapore wall boxes and wiring" },
    ],
  },
  {
    id: "furniture",
    label: "Furniture",
    match: (t) => cat(/furniture/)(t) && !has(/sofa|sectional|mattress/)(t),
    checks: [
      { key: "furn.dims", title: "Dimensions confirmed against the room plan", critical: true },
      { key: "furn.access", title: "Fits through the HDB lift and doorways (or knocks down)" },
      { key: "furn.material", title: "Materials and finish confirmed from a sample or showroom" },
    ],
  },
];

export function groupsFor(item: { name: string; specification?: string | null; workbook_category?: string | null }): RequirementGroup[] {
  return REQUIREMENT_GROUPS.filter((g) => g.match(item));
}

export function templatesFor(item: { name: string; specification?: string | null; workbook_category?: string | null }): CheckTemplate[] {
  const seen = new Set<string>();
  const out: CheckTemplate[] = [];
  for (const g of groupsFor(item)) {
    for (const c of g.checks) {
      if (!seen.has(c.key)) {
        seen.add(c.key);
        out.push(c);
      }
    }
  }
  return out;
}

export function readiness(checks: { state: CheckState; critical: boolean }[]): Readiness {
  if (checks.some((c) => c.state === "failed")) return "do_not_order";
  if (checks.some((c) => c.critical && c.state === "pending")) return "do_not_order";
  if (checks.some((c) => c.state === "pending")) return "pending";
  return "ready";
}

export const READINESS_LABEL: Record<Readiness, string> = {
  ready: "Ready to buy",
  pending: "Pending confirmation",
  do_not_order: "Do not order yet",
};

// China vs Singapore — initial homeowner preferences (suggestions only).
export function suggestSourcing(item: { name: string; specification?: string | null; workbook_category?: string | null }):
  | { pref: "china" | "singapore" | "compare"; reason: string }
  | null {
  const t = `${item.name} ${item.specification ?? ""} ${item.workbook_category ?? ""}`.toLowerCase();
  if (/purifier|water dispenser|toilet|\bwc\b|tap|mixer|shower|ceiling fan.*special/.test(t))
    return { pref: "compare", reason: "Technically sensitive — compare China and Singapore options" };
  if (/aircon|air-conditioning|refrigerator|fridge|washing machine|dryer|oven|\bhob\b|hood|dishwasher|water heater|ceiling fan/.test(t))
    return { pref: "singapore", reason: "Relies on reliable local warranty and servicing" };
  if (/pendant|decorative|lamp|sofa|chair|table|stool|bed frame|headboard|tile|stone|mirror|towel|hook|holder|handle|hardware|curtain|rug|cushion|artwork/.test(t))
    return { pref: "china", reason: "Design item where China sourcing usually offers more choice and value" };
  return null;
}
