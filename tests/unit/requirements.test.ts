import { describe, expect, it } from "vitest";
import { readiness, templatesFor, suggestSourcing, groupsFor } from "@/lib/requirements";

describe("requirements library", () => {
  it("gives the sofa its space-planning and access checks", () => {
    const keys = templatesFor({ name: "Main sofa", specification: "Cream upholstered sofa", workbook_category: "Furniture" }).map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(["sofa.dimensions", "sofa.chaise", "sofa.layout", "sofa.access", "sofa.fabric", "sofa.warranty", "sofa.price"]));
    // Generic furniture checks are not duplicated on top of the sofa ones
    expect(keys.some((k) => k.startsWith("furn."))).toBe(false);
  });

  it("matches workbook rows to the right groups", () => {
    expect(groupsFor({ name: "Dining pendant", workbook_category: "Lighting" }).map((g) => g.id)).toEqual(["lighting"]);
    expect(groupsFor({ name: "WC / flush system (WELS/PUB)", workbook_category: "Sanitary" }).map((g) => g.id)).toContain("toilet");
    expect(groupsFor({ name: "Basin mixer (PUB/WELS)", workbook_category: "Sanitary" }).map((g) => g.id)).toContain("taps");
    expect(groupsFor({ name: "Hack existing floor tiles", workbook_category: "Hacking" })).toHaveLength(0);
    expect(groupsFor({ name: "Water dispenser / filter (optional)", workbook_category: "Appliance" }).map((g) => g.id)).toEqual(["water", "appliance"]);
  });

  it("lighting asks for neutral white, not warm light", () => {
    const t = templatesFor({ name: "Feature pendant", workbook_category: "Lighting" });
    expect(t.find((c) => c.key === "light.cct")!.title).toMatch(/neutral white/i);
  });

  it("computes readiness from check states", () => {
    expect(readiness([])).toBe("ready");
    expect(readiness([{ state: "confirmed", critical: true }, { state: "not_applicable", critical: false }])).toBe("ready");
    expect(readiness([{ state: "pending", critical: false }])).toBe("pending");
    expect(readiness([{ state: "pending", critical: true }])).toBe("do_not_order");
    expect(readiness([{ state: "failed", critical: false }])).toBe("do_not_order");
  });

  it("suggests sourcing from the initial homeowner preferences", () => {
    expect(suggestSourcing({ name: "Air-conditioning system + installation" })?.pref).toBe("singapore");
    expect(suggestSourcing({ name: "Kitchen mixer tap (PUB-compliant)" })?.pref).toBe("compare");
    expect(suggestSourcing({ name: "Dining pendant" })?.pref).toBe("china");
    expect(suggestSourcing({ name: "Debris disposal / haulage" })).toBeNull();
  });
});
