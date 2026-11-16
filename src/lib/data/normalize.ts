/**
 * Canonical values (string map keyed by HEADER_MAP targets) → Characterization.
 * Used by the public snapshot builder and by the manual importer, so both
 * modes go through identical parsing, derivation and quality rules.
 */
import { createHash } from "node:crypto";
import { parseDateDMY, parseDecimal, PARSER_VERSION } from "@/lib/sdr/export-parser";
import { derive, emptyImproper, protocolVersionFor, qualityIssues } from "@/lib/analytics/formulas";
import type { MunicipalityIndex } from "./municipalities";
import { IMPROPER_KEYS, type Attribution, type Characterization, type DataMode, type QualityIssue, type SourceRef } from "./types";

/** Values that are personal data or not needed for analysis are never copied into records. */
export const EXCLUDED_FIELDS = new Set(["vehiclePlate", "attendees"]);

export function circuitKey(name: string, titular: string | null): string {
  const norm = (s: string) => s.normalize("NFC").toUpperCase().replace(/\s+/g, " ").trim();
  return `${norm(name)}|${norm(titular ?? "")}`;
}

function text(v: string | undefined): string | null {
  const s = v?.replace(/\s+/g, " ").trim();
  return s ? s : null;
}

/** Accepts dd/mm/yyyy (source) or ISO yyyy-mm-dd (imports). */
function date(v: string | undefined): string | null {
  if (!v) return null;
  const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return parseDateDMY(v);
}

/** Accepts comma decimals (source) and dot decimals (imports). */
function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim();
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  return parseDecimal(s);
}

export interface NormalizeContext {
  mode: DataMode;
  snapshotId: string;
  municipalities: MunicipalityIndex;
  source: Omit<SourceRef, "rowHash" | "line" | "snapshotId" | "parserVersion"> & { parserVersion?: string };
  acceptance?: Map<string, { status: string; acceptanceDate: string | null }>;
}

export function rowHash(values: Record<string, string>): string {
  const stable = Object.keys(values)
    .filter((k) => !EXCLUDED_FIELDS.has(k))
    .sort()
    .map((k) => `${k}=${values[k]}`)
    .join("\u0001");
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

export function normalizeRow(
  values: Record<string, string>,
  line: number | null,
  ctx: NormalizeContext,
  extraIssues: QualityIssue[] = [],
): Characterization | null {
  const id = text(values.bulletinId);
  const circuitName = text(values.circuitName);
  if (!id || !circuitName) return null;
  const titular = text(values.titular);
  const municipalities = ctx.municipalities.resolveList(values.municipalitiesRaw);
  const comarques = new Set(municipalities.map((m) => m.comarcaCode));
  let attribution: Attribution = "unresolved";
  let comarcaCode: string | null = null;
  let municipalityCode: string | null = null;
  if (municipalities.length > 0 && !comarques.has(null)) {
    if (comarques.size === 1) {
      comarcaCode = [...comarques][0]!;
      if (municipalities.length === 1) {
        attribution = "municipal";
        municipalityCode = municipalities[0]!.code;
      } else attribution = "comarcal";
    } else attribution = "supracomarcal";
  }

  const improper = emptyImproper();
  for (const k of IMPROPER_KEYS) {
    improper[k] = { kg: num(values[`kg.${k}`]), factor: num(values[`factor.${k}`]), pctReported: num(values[`pct.${k}`]) };
  }
  const sampling = date(values.samplingDate);
  const acc = ctx.acceptance?.get(id);
  const rec: Characterization = {
    id,
    mode: ctx.mode,
    stream: "FORM",
    protocolVersion: protocolVersionFor(sampling),
    circuitKey: circuitKey(circuitName, titular),
    circuitName,
    titular,
    municipalities,
    comarcaCode,
    municipalityCode,
    attribution,
    company: text(values.company),
    facility: text(values.facility),
    lot: text(values.lot),
    collectionType: text(values.collectionType),
    formType: text(values.formType),
    bulletinYear: num(values.bulletinYear),
    bulletinQuarter: num(values.bulletinQuarter),
    dates: {
      reception: date(values.receptionDate),
      sampling,
      characterization: date(values.characterizationDate),
      presentation: date(values.presentationDate),
      acceptance: acc?.acceptanceDate ?? null,
    },
    status: acc?.status ?? (ctx.mode === "public_snapshot" ? "Acceptat (consulta pública)" : null),
    dischargedKg: num(values.dischargedKg),
    sampleKg: num(values.sampleKg),
    totalWeighedKg: num(values["kg.total"]),
    lossesKg: num(values["kg.perdues"]),
    formKg: num(values["kg.form"]),
    fvKg: num(values["kg.poda"]),
    improper,
    improperKgReported: num(values["kg.totalImpropis"]),
    pctReported: {
      form: num(values["pct.form"]),
      fv: num(values["pct.fv"]),
      impropis: num(values["pct.totalImpropis"]),
      perdues: num(values["pct.perdues"]),
      total: num(values["pct.total"]),
    },
    food: {
      wasteKg: num(values["food.totalWasteKg"]),
      wastePct: num(values["food.wastePct"]),
      foodCompostablePct: num(values["food.foodCompostablePct"]),
    },
    compostableBagsPct: num(values.compostableBagsPct),
    observations: { characterization: text(values.obsCharacterization), otherWaste: text(values.obsOtherWaste) },
    quality: [],
    derived: { referenceKg: null, correctedImproperKg: null, impropisPct: null, composition: null },
    source: {
      ...ctx.source,
      parserVersion: ctx.source.parserVersion ?? PARSER_VERSION,
      snapshotId: ctx.snapshotId,
      line,
      rowHash: rowHash(values),
    },
  };
  rec.derived = derive(rec);
  rec.quality = qualityIssues(rec, undefined, extraIssues);
  return rec;
}

export function isAnalyzable(rec: Characterization, excludeLowMass: boolean): boolean {
  if (rec.derived.impropisPct === null) return false;
  if (rec.quality.some((q) => q.severity === "error")) return false;
  if (excludeLowMass && rec.quality.some((q) => q.code === "Q03")) return false;
  return true;
}
