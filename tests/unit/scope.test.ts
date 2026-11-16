import { describe, expect, it } from "vitest";
import { filtersToQuery, parseFilters } from "@/lib/analytics/filters";
import { buildScope, defaultPeriod } from "@/lib/analytics/scope";
import { changeAnalysis, groupBy } from "@/lib/analytics/metrics";
import { municipalityKey } from "@/lib/data/municipalities";
import type { DatasetMeta } from "@/lib/data/types";
import { rec } from "./helpers";

const meta = { id: "t", mode: "synthetic_demo", yearsLoaded: [2024, 2025], coverage: [] } as unknown as DatasetMeta;

describe("territorial attribution", () => {
  it("attributes single- and multi-municipality circuits within one comarca", () => {
    expect(rec().attribution).toBe("municipal");
    const r = rec({ municipalitiesRaw: "POBLE A, POBLE B" });
    expect(r.attribution).toBe("comarcal");
    expect(r.comarcaCode).toBe("41");
  });

  it("never splits or duplicates supracomarcal circuits", () => {
    const supra = rec({ bulletinId: "9", municipalitiesRaw: "POBLE A, VILA C" });
    expect(supra.attribution).toBe("supracomarcal");
    expect(supra.comarcaCode).toBeNull();
    const records = [rec({ bulletinId: "1" }), supra];
    const scope = buildScope(records, meta, parseFilters({ comarca: "41", from: "2025-01", to: "2025-12" }));
    expect(scope.inScope.map((r) => r.id)).toEqual(["1"]);
    expect(scope.exclusions.find((e) => e.code === "supracomarcal")?.count).toBe(1);
    // grouped by comarca the supracomarcal sample is not counted anywhere
    const all = buildScope(records, meta, parseFilters({ from: "2025-01", to: "2025-12" }));
    const g = groupBy(all.valid, (r) => r.comarcaCode, (k) => k, "mean_sample", 1);
    expect(g.reduce((a, x) => a + x.n, 0)).toBe(1);
  });

  it("normalises Catalan articles for municipality names", () => {
    expect(municipalityKey("la Garriga")).toBe(municipalityKey("GARRIGA"));
    expect(municipalityKey("els Alamús")).toBe("ALAMUS");
    expect(municipalityKey("l'Espluga de Francolí")).toBe("ESPLUGA DE FRANCOLI");
    expect(municipalityKey("Es Bòrdes")).toBe("BORDES");
  });
});

describe("filters are parsed safely and shared", () => {
  it("drops invalid values instead of failing", () => {
    const f = parseFilters({ from: "2025-13", estimator: "drop table", minN: "7", mode: "public_snapshot" });
    expect(f.from).toBeUndefined();
    expect(f.estimator).toBe("mean_sample");
    expect(f.minN).toBe(7);
  });

  it("round-trips through the URL and omits defaults", () => {
    const f = parseFilters({ from: "2024-01", comarca: "41", estimator: "mass_ratio" });
    expect(filtersToQuery(f)).toBe("?from=2024-01&comarca=41&estimator=mass_ratio");
    expect(parseFilters(new URLSearchParams(filtersToQuery(f).slice(1)))).toEqual(f);
  });

  it("default period starts at the most recent contiguous run of loaded years", () => {
    const m = { ...meta, yearsLoaded: [2006, 2019, 2020, 2021] } as DatasetMeta;
    expect(defaultPeriod(m, [rec({ samplingDate: "10/06/2021" })])).toEqual({ from: "2019-01", to: "2021-06" });
  });

  it("counts records without sampling date as exclusions, never silently", () => {
    const s = buildScope([rec({ bulletinId: "1" }), rec({ bulletinId: "2", samplingDate: "" })], meta, parseFilters({ from: "2025-01", to: "2025-12" }));
    expect(s.inScope).toHaveLength(1);
    expect(s.exclusions.find((e) => e.code === "no_date")?.count).toBe(1);
  });
});

describe("change analysis uses a stable cohort", () => {
  it("ignores circuits that appear in only one window for the cohort aggregate", () => {
    const mk = (id: string, circuit: string, date: string, vidre: string) => rec({ bulletinId: id, circuitName: circuit, samplingDate: date, "kg.vidre": vidre, "kg.paper": "0,00", "kg.plastic": "0,00" });
    const history = [
      ...["01/02/2024", "01/05/2024", "01/08/2024"].map((d, i) => mk(`a${i}`, "A", d, ["9,00", "10,00", "11,00"][i]!)),
      ...["01/02/2025", "01/05/2025", "01/08/2025"].map((d, i) => mk(`b${i}`, "A", d, ["19,00", "20,00", "21,00"][i]!)),
      mk("new", "NEW", "01/03/2025", "200,00"), // only in the current window
    ];
    const ch = changeAnalysis(history, "2025-12", 12);
    expect(ch.cohort.circuits).toBe(1);
    expect(ch.cohort.diffPp).toBeCloseTo(4, 1); // 4 % → 8 %
    expect(ch.allSamples.diffPp!).toBeGreaterThan(ch.cohort.diffPp!);
    expect(ch.circuits).toHaveLength(1);
    expect(ch.circuits[0]!.robust).toBe(true);
  });

  it("is conservative when an interval cannot be computed (zero variance)", () => {
    const mk = (id: string, date: string, vidre: string) => rec({ bulletinId: id, samplingDate: date, "kg.vidre": vidre, "kg.paper": "0,00", "kg.plastic": "0,00" });
    const h = [...["01/02/2024", "01/05/2024", "01/08/2024"].map((d, i) => mk(`a${i}`, d, "10,00")), ...["01/02/2025", "01/05/2025", "01/08/2025"].map((d, i) => mk(`b${i}`, d, "20,00"))];
    expect(changeAnalysis(h, "2025-12", 12).circuits[0]!.robust).toBe(false);
  });
});
