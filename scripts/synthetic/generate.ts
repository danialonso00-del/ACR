/**
 * Generates the `synthetic_demo` dataset: fictitious circuits and territories,
 * clearly marked, reproducible (seed 2026). It exists to exercise the UI and
 * tests over a long, regular history; it is never mixed with public data and
 * never assigns values to real municipalities.
 *
 *   npm run build:synthetic
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { MunicipalityIndex } from "../../src/lib/data/municipalities";
import { normalizeRow } from "../../src/lib/data/normalize";
import { QUALITY_RULE_VERSION } from "../../src/lib/analytics/formulas";
import { PARSER_VERSION } from "../../src/lib/sdr/export-parser";
import { rng } from "../../src/lib/analytics/stats";
import { IMPROPER_KEYS, type Characterization, type DatasetMeta, type YearCoverage } from "../../src/lib/data/types";

const OUT = path.resolve("data/snapshots/synthetic_demo");
const rand = rng(2026);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

const TERRITORIES = ["D1", "D2", "D3", "D4", "D5", "D6"];
const munis = Array.from({ length: 30 }, (_, i) => ({
  code: `SYN${String(i + 1).padStart(3, "0")}`,
  name: `Municipi Fictici ${String(i + 1).padStart(2, "0")}`,
  comarcaCode: TERRITORIES[i % 6]!,
  comarcaName: `Territori Fictici ${TERRITORIES[i % 6]}`,
}));
const index = new MunicipalityIndex(munis);
const share = { vidre: 0.1, paper: 0.12, plastic: 0.28, bosses: 0.14, metallFerric: 0.03, metallNoFerric: 0.02, textil: 0.06, textilSanitari: 0.08, especials: 0.01, voluminosos: 0.01, altres: 0.15 };
const fmt = (x: number) => x.toFixed(2).replace(".", ",");

const records: Characterization[] = [];
let id = 900000;
for (let c = 1; c <= 24; c++) {
  const name = `CIRCUIT FICTICI ${String(c).padStart(2, "0")}`;
  const muniList = c % 5 === 0 ? [munis[c % 30]!, munis[(c + 6) % 30]!, munis[(c + 1) % 30]!] : [munis[c % 30]!];
  const base = 3 + rand() * 12;
  const trend = (rand() - 0.5) * 0.6; // pp per year
  const seasonal = 0.6 + rand() * 1.4;
  for (let y = 2006; y <= 2026; y++) {
    for (let q = 1; q <= 4; q++) {
      if (y === 2026 && q === 4) break;
      if (rand() < 0.08) continue; // missing campaigns
      const month = (q - 1) * 3 + 1 + Math.floor(rand() * 3);
      const day = 1 + Math.floor(rand() * 27);
      const date = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${y}`;
      let imp = base + trend * (y - 2006) + seasonal * Math.sin(((month - 4) / 12) * 2 * Math.PI) + gauss() * 1.6;
      if (c === 7 && y * 12 + month >= 2023 * 12 + 4) imp -= 4; // documented fictitious intervention (2023-04)
      if (c === 12 && y >= 2025) imp += 3.5; // persistent worsening
      if (rand() < 0.01) imp += 12; // isolated spike
      imp = Math.max(0.4, imp);
      const ref = 230 + rand() * 40;
      const losses = rand() * 1.2;
      const total = ref - losses;
      const values: Record<string, string> = {
        bulletinId: String(id++),
        lot: `Lot ${1 + (c % 6)}`,
        company: "EMPRESA FICTÍCIA DE CARACTERITZACIÓ",
        bulletinQuarter: String(q),
        bulletinYear: String(y),
        circuitName: name,
        titular: `ENS FICTICI ${TERRITORIES[c % 6]}`,
        municipalitiesRaw: muniList.map((m) => m.name.toUpperCase()).join(", "),
        collectionType: c % 3 ? "Individualitzada" : "Conjunta",
        formType: "Domèstica+Comercial",
        samplingDate: date,
        characterizationDate: date,
        sampleKg: fmt(ref + (rand() < 0.05 ? 2 : 0)),
        "kg.total": fmt(total),
        "kg.perdues": fmt(losses),
        "kg.poda": fmt(rand() < 0.2 ? rand() * 5 : 0),
      };
      let impKg = 0;
      for (const k of IMPROPER_KEYS) {
        const factor = k === "paper" ? 0.66 : k === "bosses" ? 0.54 : 1;
        const kg = Math.max(0, ((imp / 100) * ref * share[k] * (0.6 + rand() * 0.8)) / factor);
        values[`kg.${k}`] = fmt(kg);
        values[`factor.${k}`] = fmt(y < 2010 ? 1 : factor);
        impKg += kg;
      }
      values["kg.totalImpropis"] = fmt(impKg);
      values["kg.form"] = fmt(total - impKg);
      const rec = normalizeRow(values, null, {
        mode: "synthetic_demo",
        snapshotId: "synthetic-seed-2026",
        municipalities: index,
        source: { file: null, sha256: null, url: null, capturedAt: null, parserVersion: "synthetic-generator/1.0.0" },
      });
      if (rec) {
        rec.status = "Sintètic";
        rec.pctReported.impropis = rec.derived.impropisPct;
        records.push(rec);
      }
    }
  }
}

const years = [...new Set(records.map((r) => r.bulletinYear!))].sort();
const coverage: YearCoverage[] = years.map((y) => {
  const rs = records.filter((r) => r.bulletinYear === y);
  return { year: y, loaded: true, samples: rs.length, circuits: new Set(rs.map((r) => r.circuitKey)).size, withSamplingDate: rs.length, withComposition: rs.length, photosIndexed: 0, issues: rs.reduce((a, r) => a + r.quality.filter((q) => q.severity !== "info").length, 0), captureSha256: null, capturedAt: null, unknownHeaders: [], missingHeaders: 0 };
});
const meta: DatasetMeta = {
  id: "synthetic_demo@seed-2026",
  mode: "synthetic_demo",
  label: "Dades sintètiques de demostració (territoris i circuits fictius)",
  builtAt: new Date().toISOString(),
  capturedFrom: null,
  capturedTo: null,
  parserVersion: PARSER_VERSION,
  qualityRuleVersion: QUALITY_RULE_VERSION,
  recordCount: records.length,
  yearsLoaded: years,
  coverage,
  notes: [
    "Dades generades amb llavor fixa (2026). No representen cap circuit, municipi ni resultat real.",
    "Inclouen una intervenció fictícia (CIRCUIT FICTICI 07, abril 2023) i un empitjorament persistent (CIRCUIT FICTICI 12, 2025) per provar les analítiques.",
  ],
};
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "records.json.gz"), gzipSync(JSON.stringify(records)));
writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
console.log(`synthetic records: ${records.length}`);
