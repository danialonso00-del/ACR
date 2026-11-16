/**
 * Writes docs/COVERAGE.md from the public snapshot metadata (coverage by year:
 * samples, circuits, available fields, photos and issues).
 *   npm run report:coverage
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Characterization, DatasetMeta } from "../../src/lib/data/types";

const meta = JSON.parse(readFileSync("data/snapshots/public_snapshot/meta.json", "utf8")) as DatasetMeta & { reconciliation?: Record<string, number> };
const records = JSON.parse(gunzipSync(readFileSync("data/snapshots/public_snapshot/records.json.gz")).toString()) as Characterization[];
const checks = existsSync("data/snapshots/public_snapshot/photo-checks.json") ? (JSON.parse(readFileSync("data/snapshots/public_snapshot/photo-checks.json", "utf8")) as { bulletinId: string; photos: number }[]) : [];
const byId = new Map(records.map((r) => [r.id, r]));

const field = (rs: Characterization[], f: (r: Characterization) => unknown) => (rs.length ? `${Math.round((100 * rs.filter((r) => f(r) !== null && f(r) !== undefined).length) / rs.length)} %` : "—");
const lines: string[] = [
  "# Cobertura del conjunt `public_snapshot`",
  "",
  `Generat per \`npm run report:coverage\` el ${new Date().toISOString().slice(0, 10)} a partir de \`${meta.id}\` (captura ${meta.capturedFrom?.slice(0, 10)} – ${meta.capturedTo?.slice(0, 10)}, parser ${meta.parserVersion}, regles ${meta.qualityRuleVersion}).`,
  "",
  "«Any» és l'any del butlletí (període declarat), que pot diferir de l'any de la data de presa de mostra. Els anys no carregats no són zeros: no s'han ingerit en aquest extracte inicial.",
  "",
  "| Any | Carregat | Mostres | Circuits | Data mostra | Composició | Factor paper informat | Malbaratament informat | Galeries comprovades | Amb fotos | Avisos/errors | SHA-256 captura |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
];
for (const c of meta.coverage) {
  const rs = records.filter((r) => r.bulletinYear === c.year);
  const ch = checks.filter((x) => byId.get(x.bulletinId)?.bulletinYear === c.year);
  lines.push(
    `| ${c.year} | ${c.loaded ? "sí" : "no"} | ${c.samples} | ${c.circuits} | ${field(rs, (r) => r.dates.sampling)} | ${field(rs, (r) => r.derived.composition)} | ${rs.length ? `${Math.round((100 * rs.filter((r) => r.improper.paper.factor !== null && r.improper.paper.factor !== 1).length) / rs.length)} % ≠ 1` : "—"} | ${field(rs, (r) => r.food.wastePct)} | ${ch.length} | ${ch.filter((x) => x.photos > 0).length} | ${c.issues} | ${c.captureSha256 ? `\`${c.captureSha256.slice(0, 12)}\`` : "—"} |`,
  );
}
const codes = new Map<string, number>();
for (const r of records) for (const q of r.quality) codes.set(q.code, (codes.get(q.code) ?? 0) + 1);
lines.push(
  "",
  "## Reconciliació",
  "",
  meta.reconciliation
    ? `- % impropis recalculat vs «% Total Impureses» del SDR (±0,1 pp): **${meta.reconciliation.impropisWithin01pp} / ${meta.reconciliation.checked}**.\n- Percentatges per categoria (±0,02 pp): **${meta.reconciliation.categoriesWithin002pp} / ${meta.reconciliation.categoryChecks}**.`
    : "- No disponible.",
  "",
  "## Incidències de qualitat (tots els anys carregats)",
  "",
  "| Regla | Registres |",
  "| --- | ---: |",
  ...[...codes.entries()].sort().map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Atribució territorial",
  "",
  ...Object.entries(records.reduce<Record<string, number>>((a, r) => ((a[r.attribution] = (a[r.attribution] ?? 0) + 1), a), {})).map(([k, v]) => `- ${k}: ${v}`),
  "",
);
writeFileSync("docs/COVERAGE.md", lines.join("\n"));
console.log("docs/COVERAGE.md written");
