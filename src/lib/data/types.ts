/** Domain contract shared by every data mode. UI components only consume these types. */

export type DataMode = "public_snapshot" | "imported" | "synthetic_demo";
export const DATA_MODES: DataMode[] = ["public_snapshot", "imported", "synthetic_demo"];

/** Waste streams are kept separate in taxonomies and metrics. Only FORM has a source today. */
export type WasteStream = "FORM" | "RESTA" | "REBUIG";

/** Improper categories as reported by the SDR export (protocol FORM). */
export const IMPROPER_KEYS = [
  "vidre",
  "paper",
  "plastic",
  "bosses",
  "metallFerric",
  "metallNoFerric",
  "textil",
  "textilSanitari",
  "especials",
  "voluminosos",
  "altres",
] as const;
export type ImproperKey = (typeof IMPROPER_KEYS)[number];

/** Composition parts that share the sample-mass denominator and are mutually exclusive. */
export const COMPOSITION_KEYS = ["form", "fv", ...IMPROPER_KEYS, "perdues"] as const;
export type CompositionKey = (typeof COMPOSITION_KEYS)[number];

export interface FractionValue {
  /** Weighed mass in the sample, as reported (kg). null = not reported. */
  kg: number | null;
  /** Correction factor applied by the source (e.g. wet paper / bags). null = not reported. */
  factor: number | null;
  /** Percentage reported by the source. */
  pctReported: number | null;
}

export type Attribution = "municipal" | "comarcal" | "supracomarcal" | "unresolved";

export interface MunicipalityRef {
  raw: string;
  code: string | null;
  name: string | null;
  comarcaCode: string | null;
}

export interface QualityIssue {
  code: string;
  severity: "error" | "warning" | "info";
  ruleVersion: string;
  detail: string;
}

export interface SourceRef {
  snapshotId: string;
  file: string | null;
  sha256: string | null;
  line: number | null;
  url: string | null;
  parserVersion: string;
  rowHash: string;
  capturedAt: string | null;
}

export interface Characterization {
  id: string;
  mode: DataMode;
  stream: WasteStream;
  protocolVersion: string;
  circuitKey: string;
  circuitName: string;
  titular: string | null;
  municipalities: MunicipalityRef[];
  comarcaCode: string | null;
  municipalityCode: string | null;
  attribution: Attribution;
  company: string | null;
  facility: string | null;
  lot: string | null;
  collectionType: string | null;
  formType: string | null;
  bulletinYear: number | null;
  bulletinQuarter: number | null;
  dates: {
    reception: string | null;
    sampling: string | null;
    characterization: string | null;
    presentation: string | null;
    acceptance: string | null;
  };
  status: string | null;
  dischargedKg: number | null;
  sampleKg: number | null;
  totalWeighedKg: number | null;
  lossesKg: number | null;
  formKg: number | null;
  fvKg: number | null;
  improper: Record<ImproperKey, FractionValue>;
  improperKgReported: number | null;
  pctReported: {
    form: number | null;
    fv: number | null;
    impropis: number | null;
    perdues: number | null;
    total: number | null;
  };
  /** Food-waste indicators measured on a sub-structure of the sample. Never summed with the composition. */
  food: {
    wasteKg: number | null;
    wastePct: number | null;
    foodCompostablePct: number | null;
  };
  compostableBagsPct: number | null;
  observations: { characterization: string | null; otherWaste: string | null };
  quality: QualityIssue[];
  /** Derived in code with a documented formula; null when inputs are missing. */
  derived: {
    /** Pes total + pèrdues (the source's denominator); see formulas.ts. */
    referenceKg: number | null;
    correctedImproperKg: number | null;
    impropisPct: number | null;
    composition: Partial<Record<CompositionKey, number>> | null;
  };
  source: SourceRef;
  revisions?: { capturedAt: string; rowHash: string; changedFields: string[] }[];
}

export interface PhotoRecord {
  bulletinId: string;
  imageId: string;
  order: number;
  typeCode: string | null;
  typeLabel: string | null;
  kind: "lot" | "identificacio" | "mostra" | "organica" | "impropi" | "incidencia" | "desconegut";
  thumbUrl: string;
  fullUrl: string;
  capturedAt: string;
  rights: string;
  sha256?: string;
}

export interface SourceCatalogEntry {
  id: string;
  name: string;
  url: string;
  status: "verificada" | "parcial" | "pendent";
  checkedAt: string;
  evidence: string;
  limitations: string;
}

export interface YearCoverage {
  year: number;
  loaded: boolean;
  samples: number;
  circuits: number;
  withSamplingDate: number;
  withComposition: number;
  photosIndexed: number;
  issues: number;
  captureSha256: string | null;
  capturedAt: string | null;
  unknownHeaders: string[];
  missingHeaders: number;
}

export interface DatasetMeta {
  id: string;
  mode: DataMode;
  label: string;
  builtAt: string;
  capturedFrom: string | null;
  capturedTo: string | null;
  parserVersion: string;
  qualityRuleVersion: string;
  recordCount: number;
  yearsLoaded: number[];
  coverage: YearCoverage[];
  notes: string[];
}

export interface Dataset {
  meta: DatasetMeta;
  records: Characterization[];
  photos: PhotoRecord[];
}
