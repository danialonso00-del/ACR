/** Applies the global filters to a dataset and records every exclusion with its reason. */
import type { Characterization, DatasetMeta } from "@/lib/data/types";
import { isAnalyzable } from "@/lib/data/normalize";
import { monthBounds, type Filters } from "./filters";

export interface Exclusion {
  code: string;
  label: string;
  count: number;
}

export interface Scope {
  filters: Filters & { from: string; to: string };
  meta: DatasetMeta;
  /** Records matching period, territory, circuit and type filters. */
  inScope: Characterization[];
  /** Subset that can be analysed (has a composition, no blocking issues, representativeness rule). */
  valid: Characterization[];
  /** Same non-period filters, whole history (used for baselines). */
  history: Characterization[];
  exclusions: Exclusion[];
  totalLoaded: number;
}

/** Default period: from January of the most recent contiguous run of loaded years to the last sampling month. */
export function defaultPeriod(meta: DatasetMeta, records: Characterization[]): { from: string; to: string } {
  const years = [...meta.yearsLoaded].sort((a, b) => a - b);
  let start = years.at(-1) ?? new Date().getFullYear();
  for (let i = years.length - 1; i > 0 && years[i - 1] === years[i]! - 1; i--) start = years[i - 1]!;
  let last = "";
  for (const r of records) if (r.dates.sampling && r.dates.sampling > last) last = r.dates.sampling;
  return { from: `${start}-01`, to: last ? last.slice(0, 7) : `${years.at(-1) ?? start}-12` };
}

export function buildScope(records: Characterization[], meta: DatasetMeta, f: Filters): Scope {
  const def = defaultPeriod(meta, records);
  const from = f.from ?? def.from;
  const to = f.to ?? def.to;
  const [start, end] = monthBounds(from, to);
  const counts = new Map<string, Exclusion>();
  const exclude = (code: string, label: string) => {
    const e = counts.get(code) ?? { code, label, count: 0 };
    e.count++;
    counts.set(code, e);
  };

  const history: Characterization[] = [];
  const inScope: Characterization[] = [];
  for (const r of records) {
    if (r.stream !== f.stream) continue;
    if (f.circuit && r.circuitKey !== f.circuit) continue;
    if (f.formType && r.formType !== f.formType) continue;
    if (f.collectionType && r.collectionType !== f.collectionType) continue;
    if (f.comarca && r.comarcaCode !== f.comarca) {
      // Supramunicipal circuits spanning several comarques are never split or duplicated.
      if (r.municipalities.some((m) => m.comarcaCode === f.comarca))
        exclude("supracomarcal", "Circuit supracomarcal sense repartiment acreditat");
      continue;
    }
    history.push(r);
    if (!r.dates.sampling) {
      exclude("no_date", "Sense data de presa de mostra");
      continue;
    }
    if ((start && r.dates.sampling < start) || (end && r.dates.sampling > end)) continue;
    inScope.push(r);
  }

  const lowMass = f.lowMass === "exclude";
  const valid = inScope.filter((r) => {
    if (isAnalyzable(r, lowMass)) return true;
    if (r.derived.impropisPct === null) exclude("no_composition", "Sense composició calculable");
    else if (r.quality.some((q) => q.severity === "error")) exclude("error", "Incidència de qualitat bloquejant (massa negativa o nul·la)");
    else exclude("low_mass", "Mostra < 90 kg (regla de representativitat)");
    return false;
  });

  return {
    filters: { ...f, from, to },
    meta,
    inScope,
    valid,
    history: history.filter((r) => isAnalyzable(r, lowMass) && r.dates.sampling),
    exclusions: [...counts.values()].sort((a, b) => b.count - a.count),
    totalLoaded: records.length,
  };
}
