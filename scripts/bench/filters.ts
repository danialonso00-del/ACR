/**
 * Measures filter + analytics latency on the local demo snapshot (server side).
 *   npm run bench
 * Reports median / p95 over repeated runs for representative scopes.
 */
import { readFileSync } from "node:fs";
import os from "node:os";
import { gunzipSync } from "node:zlib";
import { parseFilters } from "../../src/lib/analytics/filters";
import { buildScope } from "../../src/lib/analytics/scope";
import { aggregateImpropis, anomalies, changeAnalysis, composition, groupBy, timeSeries } from "../../src/lib/analytics/metrics";
import type { Characterization, DatasetMeta } from "../../src/lib/data/types";

const meta = JSON.parse(readFileSync("data/snapshots/public_snapshot/meta.json", "utf8")) as DatasetMeta;
const records = JSON.parse(gunzipSync(readFileSync("data/snapshots/public_snapshot/records.json.gz")).toString()) as Characterization[];

const scenarios: Record<string, Record<string, string>> = {
  "default (2019→)": {},
  "comarca Vallès Oriental": { comarca: "41" },
  "single circuit": { circuit: records.find((r) => r.circuitName === "FIGUERES")!.circuitKey },
  "all years, mass ratio": { from: "2006-01", estimator: "mass_ratio" },
};

function overviewWork(params: Record<string, string>) {
  const f = parseFilters(params);
  const scope = buildScope(records, meta, f);
  const { from, to, estimator } = scope.filters;
  aggregateImpropis(scope.valid, estimator);
  timeSeries(scope.valid, from, to, "quarter", estimator);
  changeAnalysis(scope.history, to, 12);
  composition(scope.valid, estimator);
  groupBy(scope.valid, (r) => r.comarcaCode, (k) => k, estimator, f.minN);
  return scope;
}

console.log(`records: ${records.length} · node ${process.version} · ${os.cpus()[0]?.model} · ${os.cpus().length} threads`);
for (const [name, params] of Object.entries(scenarios)) {
  const times: number[] = [];
  let n = 0;
  for (let i = 0; i < 25; i++) {
    const t0 = performance.now();
    n = overviewWork(params).valid.length;
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))]!.toFixed(1);
  console.log(`${name.padEnd(28)} valid=${String(n).padStart(6)}  median ${p(0.5)} ms  p95 ${p(0.95)} ms`);
}
const t0 = performance.now();
const scope = buildScope(records, meta, parseFilters({}));
anomalies(scope.history, scope.valid);
console.log(`anomalies (default scope): ${(performance.now() - t0).toFixed(1)} ms`);
