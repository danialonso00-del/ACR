import { describe, expect, it } from "vitest";
import { derive, referenceKg } from "@/lib/analytics/formulas";
import { aggregateImpropis, composition } from "@/lib/analytics/metrics";
import { isAnalyzable } from "@/lib/data/normalize";
import { COMPOSITION_KEYS } from "@/lib/data/types";
import { rec } from "./helpers";

describe("denominator and per-category percentages", () => {
  it("uses total weighed + losses as reference mass and applies correction factors", () => {
    const r = rec();
    expect(referenceKg(r)).toBe(250);
    // 2 + 3×0.66 + 5 = 8.98 kg corrected → 3.592 %
    expect(r.derived.correctedImproperKg).toBeCloseTo(8.98, 4);
    expect(r.derived.impropisPct).toBeCloseTo(3.592, 3);
    expect(r.derived.composition!.paper).toBeCloseTo(0.792, 3);
  });

  it("falls back to declared sample mass when the weighed total is missing", () => {
    const r = rec({ "kg.total": "", "kg.perdues": "" });
    expect(r.derived.referenceKg).toBe(250);
  });

  it("composition parts are exclusive and sum to 100 with the same denominator", () => {
    const r = rec();
    const total = COMPOSITION_KEYS.reduce((a, k) => a + (r.derived.composition![k] ?? 0), 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("returns no composition (not zero) when no category was reported", () => {
    const r = rec({ "kg.vidre": "", "kg.paper": "", "kg.plastic": "", "kg.altres": "" });
    expect(r.derived.impropisPct).toBeNull();
    expect(isAnalyzable(r, true)).toBe(false);
  });

  it("flags but does not correct a non-closing balance", () => {
    const r = rec({ sampleKg: "260,00" });
    expect(r.quality.map((q) => q.code)).toContain("Q04");
    expect(r.derived.referenceKg).toBe(250); // original values kept, formula unchanged
  });

  it("marks negative masses and missing sample mass as blocking errors", () => {
    expect(rec({ "kg.vidre": "-1,00" }).quality.some((q) => q.code === "Q02" && q.severity === "error")).toBe(true);
    const r = rec({ sampleKg: "", "kg.total": "" });
    expect(r.quality.some((q) => q.code === "Q01")).toBe(true);
    expect(isAnalyzable(r, true)).toBe(false);
  });

  it("applies the 90 kg representativeness rule only when configured", () => {
    const r = rec({ sampleKg: "80,00", "kg.total": "79,50" });
    expect(r.quality.some((q) => q.code === "Q03")).toBe(true);
    expect(isAnalyzable(r, true)).toBe(false);
    expect(isAnalyzable(r, false)).toBe(true);
  });

  it("does not derive anything when the denominator is zero", () => {
    expect(derive({ ...rec(), sampleKg: 0, totalWeighedKg: null, lossesKg: null }).impropisPct).toBeNull();
  });
});

describe("estimators are different and documented", () => {
  it("mean per sample vs pooled mass ratio", () => {
    const small = rec({ bulletinId: "1", sampleKg: "100,00", "kg.total": "100,00", "kg.perdues": "0,00", "kg.vidre": "10,00", "kg.paper": "0,00", "kg.plastic": "0,00" });
    const big = rec({ bulletinId: "2", sampleKg: "300,00", "kg.total": "300,00", "kg.perdues": "0,00", "kg.vidre": "0,00", "kg.paper": "0,00", "kg.plastic": "0,00" });
    expect(aggregateImpropis([small, big], "mean_sample").value).toBe(5); // (10 + 0) / 2
    expect(aggregateImpropis([small, big], "mass_ratio").value).toBe(2.5); // 10 kg / 400 kg
    expect(aggregateImpropis([], "mean_sample").value).toBeNull();
  });

  it("composition by mass ratio sums to 100 as well", () => {
    const rs = [rec({ bulletinId: "1" }), rec({ bulletinId: "2", "kg.plastic": "20,00" })];
    const c = composition(rs, "mass_ratio")!;
    expect(COMPOSITION_KEYS.reduce((a, k) => a + c[k], 0)).toBeCloseTo(100, 2);
  });
});
