/**
 * Documented, versioned formulas and quality rules. Pure functions only.
 *
 * Reconstruction of the SDR per-sample percentages (verified against the
 * reported values at snapshot build time; see docs/DATA_DICTIONARY.md):
 *
 *   reference_kg   = total_weighed_kg + losses_kg   ("Pes Total" + "Pèrdues"); falls back to
 *                    sample_kg ("Pes FORM caracteritzada") when the weighed total is missing.
 *                    Equals sample_kg whenever the mass balance closes (see rule Q04).
 *   corrected_kg_i = kg_i × factor_i                 (factor = source correction factor)
 *   pct_i          = 100 × corrected_kg_i / reference_kg
 *   pct_impropis   = Σ_i pct_i
 *   pct_perdues    = 100 × losses_kg / reference_kg
 *   pct_fv         = 100 × poda_kg / reference_kg
 *   pct_form       = 100 − pct_impropis − pct_perdues − pct_fv   (remainder, as in the source)
 *
 * Verified on the 2026-11-04/05 capture: pct_impropis reproduces "% Total Impureses"
 * within 0.1 pp for 15,063 of 15,063 samples (2006, 2019–2026).
 */
import {
  IMPROPER_KEYS,
  type Characterization,
  type CompositionKey,
  type ImproperKey,
  type QualityIssue,
} from "@/lib/data/types";

export const QUALITY_RULE_VERSION = "QR-1.0 (2026-11-04)";

export interface QualitySettings {
  /** Protocol 2022: a stopped sample is not representative below 90 kg. */
  lowMassKg: number;
  balanceToleranceKg: number;
  balanceTolerancePct: number;
  recalcTolerancePp: number;
  highLossesPct: number;
}

export const DEFAULT_QUALITY: QualitySettings = {
  lowMassKg: 90,
  balanceToleranceKg: 0.5,
  balanceTolerancePct: 0.5,
  recalcTolerancePp: 0.1,
  highLossesPct: 5,
};

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function referenceKg(rec: Pick<Characterization, "sampleKg" | "lossesKg" | "totalWeighedKg">): number | null {
  if (rec.totalWeighedKg !== null && rec.totalWeighedKg > 0) return rec.totalWeighedKg + (rec.lossesKg ?? 0);
  return rec.sampleKg;
}

export function derive(rec: Pick<Characterization, "improper" | "sampleKg" | "lossesKg" | "fvKg" | "totalWeighedKg">) {
  const sample = referenceKg(rec);
  if (sample === null || sample <= 0) {
    return { referenceKg: null, correctedImproperKg: null, impropisPct: null, composition: null };
  }
  let corrected = 0;
  let anyImproper = false;
  const composition: Partial<Record<CompositionKey, number>> = {};
  for (const k of IMPROPER_KEYS) {
    const f = rec.improper[k];
    if (f.kg === null) continue;
    anyImproper = true;
    const c = f.kg * (f.factor ?? 1);
    corrected += c;
    composition[k] = round((100 * c) / sample);
  }
  if (!anyImproper) return { referenceKg: round(sample), correctedImproperKg: null, impropisPct: null, composition: null };
  const impropisPct = (100 * corrected) / sample;
  const perdues = rec.lossesKg !== null ? (100 * rec.lossesKg) / sample : 0;
  const fv = rec.fvKg !== null ? (100 * rec.fvKg) / sample : 0;
  composition.perdues = round(perdues);
  composition.fv = round(fv);
  composition.form = round(100 - impropisPct - perdues - fv);
  return { referenceKg: round(sample), correctedImproperKg: round(corrected), impropisPct: round(impropisPct), composition };
}

export function qualityIssues(rec: Characterization, s: QualitySettings = DEFAULT_QUALITY, extra: QualityIssue[] = []): QualityIssue[] {
  const out: QualityIssue[] = [...extra];
  const add = (code: string, severity: QualityIssue["severity"], detail: string) =>
    out.push({ code, severity, ruleVersion: QUALITY_RULE_VERSION, detail });

  if (rec.sampleKg === null || rec.sampleKg <= 0) add("Q01", "error", "Massa de mostra absent o ≤ 0: no es pot calcular cap percentatge.");
  const masses: [string, number | null][] = [
    ["mostra", rec.sampleKg],
    ["pèrdues", rec.lossesKg],
    ...IMPROPER_KEYS.map((k): [string, number | null] => [k, rec.improper[k].kg]),
  ];
  const neg = masses.filter(([, v]) => v !== null && v < 0).map(([k]) => k);
  if (neg.length) add("Q02", "error", `Massa negativa a: ${neg.join(", ")}.`);
  if (rec.sampleKg !== null && rec.sampleKg > 0 && rec.sampleKg < s.lowMassKg)
    add(
      "Q03",
      "warning",
      `Mostra de ${rec.sampleKg} kg (< ${s.lowMassKg} kg). Possible mostra aturada; l'exportació no informa el motiu de l'aturada.`,
    );
  if (rec.sampleKg && rec.totalWeighedKg !== null) {
    const balance = rec.totalWeighedKg + (rec.lossesKg ?? 0) - rec.sampleKg;
    const tol = Math.max(s.balanceToleranceKg, (s.balanceTolerancePct / 100) * rec.sampleKg);
    if (Math.abs(balance) > tol)
      add(
        "Q04",
        "warning",
        `Balanç no tancat: pes total + pèrdues − massa declarada = ${balance.toFixed(2)} kg (tolerància ${tol.toFixed(2)} kg). Els percentatges usen pes total + pèrdues, com la font.`,
      );
  }
  if (rec.derived.impropisPct !== null && rec.pctReported.impropis !== null) {
    const diff = rec.derived.impropisPct - rec.pctReported.impropis;
    if (Math.abs(diff) > s.recalcTolerancePp)
      add("Q05", "warning", `Impropis recalculats (${rec.derived.impropisPct.toFixed(2)} %) difereixen del valor informat (${rec.pctReported.impropis.toFixed(2)} %) en ${diff.toFixed(2)} pp.`);
  }
  const ref = rec.derived.referenceKg;
  if (ref && rec.lossesKg !== null && (100 * rec.lossesKg) / ref > s.highLossesPct)
    add("Q06", "info", `Pèrdues del ${((100 * rec.lossesKg) / ref).toFixed(1)} % (llindar configurable de la demo: ${s.highLossesPct} %).`);
  if (!rec.dates.sampling) add("Q07", "warning", "Data de presa de mostra absent: el registre no entra a les sèries temporals.");
  const unresolved = rec.municipalities.filter((m) => !m.code).map((m) => m.raw);
  if (unresolved.length) add("Q08", "info", `Municipi no resolt amb el nomenclàtor ICGC: ${unresolved.join(", ")}.`);
  if (rec.pctReported.total !== null && rec.pctReported.perdues !== null && Math.abs(rec.pctReported.total + rec.pctReported.perdues - 100) > 0.1)
    add("Q10", "info", `% total + % pèrdues informats = ${(rec.pctReported.total + rec.pctReported.perdues).toFixed(2)} (≠ 100).`);
  const missingFactor = IMPROPER_KEYS.filter((k) => (rec.improper[k].kg ?? 0) > 0 && rec.improper[k].factor === null);
  if (missingFactor.length) add("Q11", "info", `Factor corrector no informat (s'aplica 1,00) a: ${missingFactor.join(", ")}.`);
  const { sampling, characterization, reception } = rec.dates;
  if ((sampling && characterization && sampling > characterization) || (reception && sampling && reception > sampling))
    add("Q12", "warning", "Ordre de dates incoherent (recepció → presa de mostra → caracterització).");
  if (rec.improperKgReported !== null) {
    const sum = IMPROPER_KEYS.reduce((acc, k) => acc + (rec.improper[k].kg ?? 0), 0);
    if (Math.abs(sum - rec.improperKgReported) > 0.05)
      add("Q13", "warning", `Suma de categories (${sum.toFixed(2)} kg) ≠ pes total impropis informat (${rec.improperKgReported.toFixed(2)} kg).`);
  }
  return out;
}

export const QUALITY_RULES: { code: string; severity: QualityIssue["severity"]; label: string }[] = [
  { code: "Q01", severity: "error", label: "Massa de mostra absent o ≤ 0" },
  { code: "Q02", severity: "error", label: "Massa negativa" },
  { code: "Q03", severity: "warning", label: "Mostra inferior al llindar de representativitat (90 kg)" },
  { code: "Q04", severity: "warning", label: "Balanç de masses no tancat" },
  { code: "Q05", severity: "warning", label: "Diferència entre impropis recalculats i informats" },
  { code: "Q06", severity: "info", label: "Pèrdues elevades (llindar de demo)" },
  { code: "Q07", severity: "warning", label: "Sense data de presa de mostra" },
  { code: "Q08", severity: "info", label: "Municipi no resolt" },
  { code: "Q09", severity: "info", label: "Fila realineada (observacions amb ';')" },
  { code: "Q10", severity: "info", label: "% total + pèrdues ≠ 100" },
  { code: "Q11", severity: "info", label: "Factor corrector no informat" },
  { code: "Q12", severity: "warning", label: "Ordre de dates incoherent" },
  { code: "Q13", severity: "warning", label: "Suma de categories ≠ total impropis" },
  { code: "Q14", severity: "info", label: "Indicador a 0 en tot l'any (probablement no mesurat)" },
];

export function protocolVersionFor(samplingDate: string | null): string {
  if (!samplingDate) return "desconeguda";
  // The attached protocol is dated October 2022; earlier versions are not yet identified.
  return samplingDate >= "2022-10-01" ? "FORM oct-2022" : "anterior a oct-2022 (no identificada)";
}

export function emptyImproper(): Record<ImproperKey, { kg: number | null; factor: number | null; pctReported: number | null }> {
  return Object.fromEntries(IMPROPER_KEYS.map((k) => [k, { kg: null, factor: null, pctReported: null }])) as Record<
    ImproperKey,
    { kg: number | null; factor: number | null; pctReported: number | null }
  >;
}
