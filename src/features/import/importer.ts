import "server-only";
/**
 * Manual importer (CSV / XLSX / JSON) → `imported` dataset. Uses the same
 * normalisation and quality rules as the public snapshot. Uploads are size
 * and type checked, stored outside any served directory and never executed.
 */
import { randomBytes, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { HEADER_MAP, normaliseHeader } from "@/lib/sdr/export-parser";
import { MunicipalityIndex, type MunicipalityEntry } from "@/lib/data/municipalities";
import { normalizeRow } from "@/lib/data/normalize";
import { QUALITY_RULE_VERSION } from "@/lib/analytics/formulas";
import { RUNTIME_DIR, invalidateDataset } from "@/lib/data/repository";
import type { Characterization, DatasetMeta, YearCoverage } from "@/lib/data/types";

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 50_000;
const UPLOADS = path.join(RUNTIME_DIR, "uploads");

/** Canonical import fields shown in the mapping UI (subset of HEADER_MAP targets + required ones). */
export const IMPORT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "bulletinId", label: "Identificador del butlletí", required: true },
  { key: "circuitName", label: "Circuit", required: true },
  { key: "samplingDate", label: "Data de presa de mostra", required: true },
  { key: "titular", label: "Ens titular" },
  { key: "municipalitiesRaw", label: "Municipi/s (separats per comes)" },
  { key: "characterizationDate", label: "Data de caracterització" },
  { key: "bulletinYear", label: "Any del butlletí" },
  { key: "bulletinQuarter", label: "Trimestre del butlletí" },
  { key: "company", label: "Empresa caracteritzadora" },
  { key: "facility", label: "Instal·lació" },
  { key: "collectionType", label: "Tipus de recollida" },
  { key: "formType", label: "Tipus FORM" },
  { key: "sampleKg", label: "Massa de mostra declarada (kg)" },
  { key: "kg.total", label: "Pes total pesat (kg)" },
  { key: "kg.perdues", label: "Pèrdues (kg)" },
  { key: "kg.form", label: "FORM (kg)" },
  { key: "kg.poda", label: "Poda / FV (kg)" },
  ...["vidre", "paper", "plastic", "bosses", "metallFerric", "metallNoFerric", "textil", "textilSanitari", "especials", "voluminosos", "altres"].flatMap((k) => [
    { key: `kg.${k}`, label: `${k} (kg)` },
    { key: `factor.${k}`, label: `${k} — factor corrector` },
  ]),
  { key: "kg.totalImpropis", label: "Total impropis (kg)" },
  { key: "pct.totalImpropis", label: "% impropis informat" },
  { key: "obsCharacterization", label: "Observacions" },
];

export interface UploadPreview {
  uploadId: string;
  fileName: string;
  format: "csv" | "xlsx" | "json";
  sha256: string;
  headers: string[];
  rowCount: number;
  sample: string[][];
  suggested: Record<string, number>;
}

function sniff(buf: Buffer, name: string): "csv" | "xlsx" | "json" | null {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".xlsx" && buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "xlsx";
  const head = buf.subarray(0, 2048).toString("utf8").trimStart();
  if (ext === ".json" && (head.startsWith("[") || head.startsWith("{"))) return "json";
  if ((ext === ".csv" || ext === ".txt") && !buf.subarray(0, 4096).includes(0)) return "csv";
  return null;
}

function decodeText(buf: Buffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // Heuristic: many replacement chars → legacy encoding (e.g. the SDR export).
  return (utf8.match(/�/g)?.length ?? 0) > 3 ? new TextDecoder("windows-1252").decode(buf) : utf8.replace(/^﻿/, "");
}

function suggest(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headers.forEach((h, i) => {
    const target = HEADER_MAP[normaliseHeader(h)] ?? (IMPORT_FIELDS.some((f) => f.key === h) ? h : undefined);
    if (target && out[target] === undefined && IMPORT_FIELDS.some((f) => f.key === target)) out[target] = i;
  });
  return out;
}

export async function createPreview(file: File): Promise<UploadPreview> {
  if (file.size > MAX_BYTES) throw new Error(`Fitxer massa gran (màxim ${MAX_BYTES / 1024 / 1024} MB).`);
  const buf = Buffer.from(await file.arrayBuffer());
  const name = path.basename(file.name).replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const format = sniff(buf, name);
  if (!format) throw new Error("Format no admès. Accepta .csv, .xlsx o .json (contingut verificat).");
  let rows: string[][] = [];
  if (format === "csv") {
    const parsed = Papa.parse<string[]>(decodeText(buf), { skipEmptyLines: true, delimiter: "" });
    rows = parsed.data.filter((r) => !(r.length === 1 && String(r[0]).startsWith("#")));
  } else if (format === "xlsx") {
    const sheet = await readSheet(buf);
    rows = sheet.map((r) => r.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))));
  } else {
    const data = JSON.parse(decodeText(buf)) as unknown;
    const arr = Array.isArray(data) ? data : Array.isArray((data as { records?: unknown }).records) ? (data as { records: unknown[] }).records : null;
    if (!arr || !arr.length || typeof arr[0] !== "object") throw new Error("El JSON ha de ser una llista d'objectes.");
    const headers = [...new Set(arr.flatMap((o) => Object.keys(o as object)))].slice(0, 200);
    rows = [headers, ...arr.map((o) => headers.map((h) => { const v = (o as Record<string, unknown>)[h]; return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); }))];
  }
  if (rows.length < 2) throw new Error("No hi ha files de dades.");
  if (rows.length - 1 > MAX_ROWS) throw new Error(`Massa files (màxim ${MAX_ROWS}).`);
  const headers = rows[0]!.map((h) => String(h).trim()).slice(0, 200);
  const uploadId = randomBytes(8).toString("hex");
  mkdirSync(UPLOADS, { recursive: true });
  const sha256 = createHash("sha256").update(buf).digest("hex");
  writeFileSync(path.join(UPLOADS, `${uploadId}.json`), JSON.stringify({ name, format, sha256, headers, rows: rows.slice(1), createdAt: new Date().toISOString() }));
  return { uploadId, fileName: name, format, sha256, headers, rowCount: rows.length - 1, sample: rows.slice(1, 11).map((r) => r.slice(0, headers.length).map((c) => String(c).slice(0, 120))), suggested: suggest(headers) };
}

export function commitImport(uploadId: string, mapping: Record<string, number>, label: string) {
  if (!/^[a-f0-9]{16}$/.test(uploadId)) throw new Error("Upload id invàlid");
  const file = path.join(UPLOADS, `${uploadId}.json`);
  if (!existsSync(file)) throw new Error("La càrrega ha caducat; torna a pujar el fitxer.");
  const up = JSON.parse(readFileSync(file, "utf8")) as { name: string; format: string; sha256: string; headers: string[]; rows: string[][]; createdAt: string };
  for (const f of IMPORT_FIELDS.filter((x) => x.required)) if (mapping[f.key] === undefined) throw new Error(`Falta mapejar el camp obligatori: ${f.label}`);
  const allowed = new Set(IMPORT_FIELDS.map((f) => f.key));
  const muni = JSON.parse(readFileSync(path.join(process.cwd(), "data", "geo", "municipis.json"), "utf8")) as { municipis: MunicipalityEntry[] };
  const index = new MunicipalityIndex(muni.municipis);
  const importId = `imp-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex")}`;
  const records: Characterization[] = [];
  const rejected: { line: number; reason: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < up.rows.length; i++) {
    const row = up.rows[i]!;
    const values: Record<string, string> = {};
    for (const [key, col] of Object.entries(mapping)) if (allowed.has(key) && Number.isInteger(col) && col >= 0) values[key] = String(row[col] ?? "");
    const rec = normalizeRow(values, i + 2, { mode: "imported", snapshotId: importId, municipalities: index, source: { file: up.name, sha256: up.sha256, url: null, capturedAt: up.createdAt, parserVersion: "manual-importer/1.0.0" } });
    if (!rec) {
      rejected.push({ line: i + 2, reason: "Falta identificador o circuit" });
      continue;
    }
    if (seen.has(rec.id)) {
      rejected.push({ line: i + 2, reason: `Identificador duplicat ${rec.id}` });
      continue;
    }
    seen.add(rec.id);
    records.push(rec);
  }
  if (!records.length) throw new Error("Cap fila vàlida després del mapatge.");
  const years = [...new Set(records.map((r) => Number(r.dates.sampling?.slice(0, 4))).filter(Number.isFinite))].sort();
  const coverage: YearCoverage[] = years.map((y) => {
    const rs = records.filter((r) => r.dates.sampling?.startsWith(String(y)));
    return { year: y, loaded: true, samples: rs.length, circuits: new Set(rs.map((r) => r.circuitKey)).size, withSamplingDate: rs.length, withComposition: rs.filter((r) => r.derived.composition).length, photosIndexed: 0, issues: rs.reduce((a, r) => a + r.quality.filter((q) => q.severity !== "info").length, 0), captureSha256: up.sha256, capturedAt: up.createdAt, unknownHeaders: [], missingHeaders: 0 };
  });
  const meta: DatasetMeta = {
    id: importId,
    mode: "imported",
    label: label.trim().slice(0, 120) || up.name,
    builtAt: new Date().toISOString(),
    capturedFrom: up.createdAt,
    capturedTo: up.createdAt,
    parserVersion: "manual-importer/1.0.0",
    qualityRuleVersion: QUALITY_RULE_VERSION,
    recordCount: records.length,
    yearsLoaded: years,
    coverage,
    notes: [`Fitxer: ${up.name} (${up.format}, sha256 ${up.sha256.slice(0, 12)}…)`, `Files rebutjades: ${rejected.length}`],
  };
  const dir = path.join(RUNTIME_DIR, "imports", importId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "records.json.gz"), gzipSync(JSON.stringify(records)));
  writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  writeFileSync(path.join(dir, "mapping.json"), JSON.stringify({ mapping, headers: up.headers, rejected: rejected.slice(0, 500) }, null, 2));
  invalidateDataset(`imported:${importId}`);
  return { importId, records: records.length, rejected: rejected.length, rejectedSample: rejected.slice(0, 10), issues: records.reduce((a, r) => a + r.quality.filter((q) => q.severity !== "info").length, 0) };
}
