/**
 * Builds the `public_snapshot` dataset from the immutable raw captures.
 *
 *   npm run build:snapshot
 *
 * Idempotent: records are keyed by bulletin id. When the same bulletin appears
 * in several captures with different content, the latest wins and the earlier
 * versions are kept as `revisions` (field-level diff). Output is deterministic
 * for a given set of raw captures.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { parseExportCsv, PARSER_VERSION } from "../../src/lib/sdr/export-parser";
import { parseListHtml } from "../../src/lib/sdr/html-parsers";
import { MunicipalityIndex, type MunicipalityEntry } from "../../src/lib/data/municipalities";
import { normalizeRow } from "../../src/lib/data/normalize";
import { QUALITY_RULE_VERSION } from "../../src/lib/analytics/formulas";
import type { Characterization, DatasetMeta, PhotoRecord, QualityIssue, YearCoverage } from "../../src/lib/data/types";
import { readManifest, readRaw, type RawCapture } from "./raw-store";

const OUT = path.resolve("data/snapshots/public_snapshot");
const FIRST_YEAR = 2006;
const decode = (b: Buffer) => new TextDecoder("windows-1252").decode(b);

function main() {
  const muni = JSON.parse(readFileSync("data/geo/municipis.json", "utf8")) as { municipis: MunicipalityEntry[] };
  const index = new MunicipalityIndex(muni.municipis);
  const manifest = readManifest();
  const byYear = new Map<string, RawCapture[]>();
  for (const c of manifest.filter((c) => c.kind === "export_csv" && (c.contentType ?? "").includes("csv"))) {
    byYear.set(c.key, [...(byYear.get(c.key) ?? []), c].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)));
  }

  const records = new Map<string, Characterization>();
  const coverage: YearCoverage[] = [];
  const reconciliation = { checked: 0, impropisWithin01pp: 0, categoriesWithin002pp: 0, categoryChecks: 0 };

  for (const [year, captures] of [...byYear.entries()].sort()) {
    // Acceptance dates/status from the latest list capture of the same year.
    const listCap = manifest.filter((c) => c.kind === "list_html" && c.key === year).at(-1);
    const acceptance = new Map<string, { status: string; acceptanceDate: string | null }>();
    if (listCap) for (const r of parseListHtml(decode(readRaw(listCap))).rows) acceptance.set(r.id, { status: r.status, acceptanceDate: r.acceptanceDate });

    let last: ReturnType<typeof parseExportCsv> | null = null;
    let lastCap: RawCapture | null = null;
    for (const cap of captures) {
      const parsed = parseExportCsv(decode(readRaw(cap)));
      last = parsed;
      lastCap = cap;
      for (const row of parsed.rows) {
        const extra: QualityIssue[] = row.realigned
          ? [{ code: "Q09", severity: "info", ruleVersion: QUALITY_RULE_VERSION, detail: "Les observacions contenien ';' i la fila s'ha realineat; la separació entre els dos camps d'observacions pot ser ambigua." }]
          : [];
        const rec = normalizeRow(
          row.values,
          row.line,
          {
            mode: "public_snapshot",
            snapshotId: `sdr-${year}-${cap.sha256.slice(0, 8)}`,
            municipalities: index,
            acceptance,
            source: {
              file: cap.file,
              sha256: cap.sha256,
              url: `https://sdr.arc.cat/cform/EditCaracteritzacions.do?oid=${row.values.bulletinId}&accio=Modificar`,
              capturedAt: cap.capturedAt,
            },
          },
          extra,
        );
        if (!rec) continue;
        const prev = records.get(rec.id);
        if (prev && prev.source.rowHash !== rec.source.rowHash) {
          const changed = diffFields(prev, rec);
          rec.revisions = [...(prev.revisions ?? []), { capturedAt: prev.source.capturedAt ?? "", rowHash: prev.source.rowHash, changedFields: changed }];
        } else if (prev?.revisions) rec.revisions = prev.revisions;
        records.set(rec.id, rec);
      }
    }
    const yearRecs = [...records.values()].filter((r) => String(r.bulletinYear) === year);
    // Year-level "zero means not measured" detection: original values are kept, records are flagged.
    const allZero = (f: (r: Characterization) => number | null) => yearRecs.length > 0 && yearRecs.every((r) => f(r) === 0);
    const notMeasured = [
      allZero((r) => r.food.wastePct) ? "indicadors de malbaratament alimentari" : null,
      yearRecs.length > 0 && yearRecs.every((r) => Object.values(r.improper).every((x) => x.factor === null || x.factor === 1)) ? "factors correctors (tots 1,00)" : null,
    ].filter(Boolean);
    if (notMeasured.length) {
      for (const r of yearRecs)
        r.quality.push({ code: "Q14", severity: "info", ruleVersion: QUALITY_RULE_VERSION, detail: `A tot l'any ${year} ${notMeasured.join(" i ")} valen 0/1: probablement no mesurats o no aplicats (no es tracten com a zero real).` });
    }
    for (const r of yearRecs) {
      if (r.derived.impropisPct === null || r.pctReported.impropis === null) continue;
      reconciliation.checked++;
      if (Math.abs(r.derived.impropisPct - r.pctReported.impropis) <= 0.1) reconciliation.impropisWithin01pp++;
      for (const [k, f] of Object.entries(r.improper)) {
        const c = r.derived.composition?.[k as keyof typeof r.derived.composition];
        if (f.pctReported === null || c === undefined) continue;
        reconciliation.categoryChecks++;
        if (Math.abs(c - f.pctReported) <= 0.02) reconciliation.categoriesWithin002pp++;
      }
    }
    coverage.push({
      year: Number(year),
      loaded: true,
      samples: yearRecs.length,
      circuits: new Set(yearRecs.map((r) => r.circuitKey)).size,
      withSamplingDate: yearRecs.filter((r) => r.dates.sampling).length,
      withComposition: yearRecs.filter((r) => r.derived.composition).length,
      photosIndexed: 0,
      issues: yearRecs.reduce((a, r) => a + r.quality.filter((q) => q.severity !== "info").length, 0),
      captureSha256: lastCap?.sha256 ?? null,
      capturedAt: lastCap?.capturedAt ?? null,
      unknownHeaders: last?.unknownHeaders ?? [],
      missingHeaders: last?.missingKnownHeaders.length ?? 0,
    });
  }

  const currentYear = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", year: "numeric" }).format(new Date()));
  for (let y = FIRST_YEAR; y <= currentYear; y++) {
    if (!coverage.some((c) => c.year === y))
      coverage.push({ year: y, loaded: false, samples: 0, circuits: 0, withSamplingDate: 0, withComposition: 0, photosIndexed: 0, issues: 0, captureSha256: null, capturedAt: null, unknownHeaders: [], missingHeaders: 0 });
  }
  coverage.sort((a, b) => a.year - b.year);

  const photosPath = path.join(OUT, "photos.json");
  const photos: PhotoRecord[] = existsSync(photosPath) ? JSON.parse(readFileSync(photosPath, "utf8")) : [];
  for (const c of coverage) {
    const ids = new Set([...records.values()].filter((r) => r.bulletinYear === c.year).map((r) => r.id));
    c.photosIndexed = new Set(photos.filter((p) => ids.has(p.bulletinId)).map((p) => p.bulletinId)).size;
  }

  const all = [...records.values()].sort((a, b) => Number(a.id) - Number(b.id));
  const captureDates = [...byYear.values()].flat().map((c) => c.capturedAt).sort();
  const meta: DatasetMeta & { reconciliation: typeof reconciliation } = {
    id: `public_snapshot@${(captureDates.at(-1) ?? "").slice(0, 10)}`,
    mode: "public_snapshot",
    label: "Extracte públic SDR · FORM circuits de servei públic",
    builtAt: new Date().toISOString(),
    capturedFrom: captureDates[0] ?? null,
    capturedTo: captureDates.at(-1) ?? null,
    parserVersion: PARSER_VERSION,
    qualityRuleVersion: QUALITY_RULE_VERSION,
    recordCount: all.length,
    yearsLoaded: coverage.filter((c) => c.loaded).map((c) => c.year),
    coverage,
    notes: [
      "Any = any del butlletí (període de declaració), que pot diferir de l'any de la data de presa de mostra.",
      "Només inclou butlletins visibles a la consulta pública (estat Acceptat).",
      "Les matrícules i els noms d'assistents de l'exportació no es copien al conjunt analític.",
    ],
    reconciliation,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "records.json.gz"), gzipSync(JSON.stringify(all), { level: 9 }));
  writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  const issues = all.flatMap((r) => r.quality.map((q) => q.code));
  const counts = Object.fromEntries([...new Set(issues)].sort().map((c) => [c, issues.filter((x) => x === c).length]));
  console.log(`records: ${all.length}; years: ${meta.yearsLoaded.join(", ")}`);
  console.log("attribution:", tally(all.map((r) => r.attribution)));
  console.log("issues:", counts);
  console.log("reconciliation:", reconciliation);
}

function tally(xs: string[]) {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return m;
}

function diffFields(a: Characterization, b: Characterization): string[] {
  const keys: (keyof Characterization)[] = ["circuitName", "titular", "sampleKg", "totalWeighedKg", "lossesKg", "improper", "pctReported", "dates", "observations", "company", "facility"];
  return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

main();
