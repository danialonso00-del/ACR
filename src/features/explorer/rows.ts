import "server-only";
import { isAnalyzable } from "@/lib/data/normalize";
import type { LoadedDataset } from "@/lib/data/repository";
import type { Characterization } from "@/lib/data/types";
import type { Scope } from "@/lib/analytics/scope";
import { IMPROPER_KEYS } from "@/lib/data/types";
import { CATEGORY_LABEL } from "@/lib/categories";

export interface ExplorerRow {
  id: string;
  circuit: string;
  titular: string | null;
  municipalities: string;
  comarca: string | null;
  attribution: string;
  sampling: string | null;
  characterization: string | null;
  bulletin: string;
  company: string | null;
  facility: string | null;
  formType: string | null;
  collectionType: string | null;
  referenceKg: number | null;
  impropisPct: number | null;
  reportedPct: number | null;
  issues: number;
  severity: "error" | "warning" | "info" | null;
  photos: number | null;
  analyzable: boolean;
  protocol: string;
}

export const SORTABLE: (keyof ExplorerRow)[] = ["id", "circuit", "titular", "comarca", "sampling", "characterization", "company", "facility", "referenceKg", "impropisPct", "issues", "photos"];

export function toRow(r: Characterization, ds: LoadedDataset, comarques: Map<string, string>, lowMassExcluded: boolean): ExplorerRow {
  const sev = r.quality.some((q) => q.severity === "error") ? "error" : r.quality.some((q) => q.severity === "warning") ? "warning" : r.quality.length ? "info" : null;
  const check = ds.photoChecks.get(r.id);
  return {
    id: r.id,
    circuit: r.circuitName,
    titular: r.titular,
    municipalities: r.municipalities.map((m) => m.name ?? m.raw).join(", "),
    comarca: r.comarcaCode ? (comarques.get(r.comarcaCode) ?? r.comarcaCode) : null,
    attribution: r.attribution,
    sampling: r.dates.sampling,
    characterization: r.dates.characterization,
    bulletin: `${r.bulletinYear ?? "?"}-T${r.bulletinQuarter ?? "?"}`,
    company: r.company,
    facility: r.facility,
    formType: r.formType,
    collectionType: r.collectionType,
    referenceKg: r.derived.referenceKg,
    impropisPct: r.derived.impropisPct,
    reportedPct: r.pctReported.impropis,
    issues: r.quality.filter((q) => q.severity !== "info").length,
    severity: sev,
    photos: check ? check.photos : null,
    analyzable: isAnalyzable(r, lowMassExcluded),
    protocol: r.protocolVersion,
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function queryRows(scope: Scope, ds: LoadedDataset, comarques: Map<string, string>, opts: { q?: string; sort?: string; dir?: "asc" | "desc"; onlyValid?: boolean }) {
  const lowMass = scope.filters.lowMass === "exclude";
  let rows = scope.inScope.map((r) => toRow(r, ds, comarques, lowMass));
  if (opts.onlyValid) rows = rows.filter((r) => r.analyzable);
  if (opts.q) {
    const q = norm(opts.q.slice(0, 100));
    rows = rows.filter((r) => norm(`${r.id} ${r.circuit} ${r.titular ?? ""} ${r.municipalities} ${r.company ?? ""} ${r.facility ?? ""}`).includes(q));
  }
  const key = (SORTABLE as string[]).includes(opts.sort ?? "") ? (opts.sort as keyof ExplorerRow) : "sampling";
  const dir = opts.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === y) return Number(b.id) - Number(a.id);
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    if (key === "id") return (Number(x) - Number(y)) * dir;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ca")) * dir;
  });
  return rows;
}

/** Full export columns: identification, dates, masses, every category (kg, factor, pp) and provenance. */
export function exportColumns() {
  const cols: { label: string; get: (r: Characterization) => string | number | null }[] = [
    { label: "butlleti_id", get: (r) => r.id },
    { label: "mode_dades", get: (r) => r.mode },
    { label: "flux", get: (r) => r.stream },
    { label: "circuit", get: (r) => r.circuitName },
    { label: "ens_titular", get: (r) => r.titular },
    { label: "municipis", get: (r) => r.municipalities.map((m) => m.name ?? m.raw).join(", ") },
    { label: "codis_municipi", get: (r) => r.municipalities.map((m) => m.code ?? "").join(", ") },
    { label: "comarca_codi", get: (r) => r.comarcaCode },
    { label: "atribucio", get: (r) => r.attribution },
    { label: "any_butlleti", get: (r) => r.bulletinYear },
    { label: "trimestre_butlleti", get: (r) => r.bulletinQuarter },
    { label: "data_presa_mostra", get: (r) => r.dates.sampling },
    { label: "data_caracteritzacio", get: (r) => r.dates.characterization },
    { label: "data_presentacio", get: (r) => r.dates.presentation },
    { label: "data_acceptacio", get: (r) => r.dates.acceptance },
    { label: "empresa", get: (r) => r.company },
    { label: "installacio", get: (r) => r.facility },
    { label: "tipus_form", get: (r) => r.formType },
    { label: "tipus_recollida", get: (r) => r.collectionType },
    { label: "protocol", get: (r) => r.protocolVersion },
    { label: "massa_declarada_kg", get: (r) => r.sampleKg },
    { label: "pes_total_kg", get: (r) => r.totalWeighedKg },
    { label: "perdues_kg", get: (r) => r.lossesKg },
    { label: "massa_referencia_kg", get: (r) => r.derived.referenceKg },
    { label: "impropis_corregits_kg", get: (r) => r.derived.correctedImproperKg },
    { label: "impropis_pct_calculat", get: (r) => r.derived.impropisPct },
    { label: "impropis_pct_informat", get: (r) => r.pctReported.impropis },
  ];
  for (const k of IMPROPER_KEYS) {
    cols.push({ label: `${k}_kg`, get: (r) => r.improper[k].kg });
    cols.push({ label: `${k}_factor`, get: (r) => r.improper[k].factor });
    cols.push({ label: `${k}_pp`, get: (r) => r.derived.composition?.[k] ?? null });
  }
  cols.push(
    { label: "qualitat_codis", get: (r) => r.quality.map((q) => q.code).join(" ") },
    { label: "url_oficial", get: (r) => r.source.url },
    { label: "captura_sha256", get: (r) => r.source.sha256 },
    { label: "fila_hash", get: (r) => r.source.rowHash },
    { label: "parser", get: (r) => r.source.parserVersion },
  );
  return cols;
}

export const CATEGORY_HEADER_NOTE = `Categories: ${IMPROPER_KEYS.map((k) => `${k}=${CATEGORY_LABEL[k]}`).join("; ")}`;
