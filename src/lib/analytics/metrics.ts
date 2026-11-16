/**
 * Metric computations over a scope. Every function returns the numbers together
 * with n, estimator and the ids needed to trace them back to samples.
 */
import { COMPOSITION_KEYS, IMPROPER_KEYS, type Characterization, type CompositionKey, type ImproperKey } from "@/lib/data/types";
import { addMonths, type Estimator } from "./filters";
import { kruskalWallis, mad, mean, median, quantile, rng, round, welch } from "./stats";

export const MIN_SAMPLES_PER_WINDOW = 3;

/** Groups in O(n) (avoid re-spreading arrays inside loops). */
export function groupInto<T>(items: Iterable<T>, keyFn: (x: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const k = keyFn(x);
    if (k === null) continue;
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}
export const ANOMALY_Z = 3.5;
export const ANOMALY_MIN_HISTORY = 8;

export const ESTIMATOR_INFO: Record<Estimator, { label: string; formula: string }> = {
  mean_sample: {
    label: "Mitjana simple per mostra",
    formula: "mitjana( 100 × Σ kg_impropi·factor / (pes total + pèrdues) ) — cada mostra pesa igual",
  },
  mass_ratio: {
    label: "Percentatge per massa caracteritzada",
    formula: "100 × Σ_mostres Σ kg_impropi·factor / Σ_mostres (pes total + pèrdues) — les mostres més grans pesen més",
  },
};

export interface Aggregate {
  value: number | null;
  n: number;
  circuits: number;
  estimator: Estimator;
  referenceKg: number;
}

export function aggregateImpropis(recs: Characterization[], estimator: Estimator): Aggregate {
  let n = 0;
  let refSum = 0;
  let pctSum = 0;
  let impKg = 0;
  const circuits = new Set<string>();
  for (const r of recs) {
    const pct = r.derived.impropisPct;
    const ref = r.derived.referenceKg;
    if (pct === null || !ref) continue;
    n++;
    refSum += ref;
    pctSum += pct;
    impKg += r.derived.correctedImproperKg ?? 0;
    circuits.add(r.circuitKey);
  }
  const value = n ? (estimator === "mean_sample" ? pctSum / n : (100 * impKg) / refSum) : null;
  return { value: value === null ? null : round(value, 2), n, circuits: circuits.size, estimator, referenceKg: round(refSum, 1) };
}

export function composition(recs: Characterization[], estimator: Estimator): Record<CompositionKey, number> | null {
  // Single pass: accumulate per-key sums (mean of samples) and mass-weighted sums.
  const plain = new Array<number>(COMPOSITION_KEYS.length).fill(0);
  const weighted = new Array<number>(COMPOSITION_KEYS.length).fill(0);
  let n = 0;
  let refSum = 0;
  for (const r of recs) {
    const comp = r.derived.composition;
    const ref = r.derived.referenceKg;
    if (!comp || !ref) continue;
    n++;
    refSum += ref;
    for (let i = 0; i < COMPOSITION_KEYS.length; i++) {
      const v = comp[COMPOSITION_KEYS[i]!] ?? 0;
      plain[i]! += v;
      weighted[i]! += v * ref;
    }
  }
  if (!n) return null;
  const out = {} as Record<CompositionKey, number>;
  COMPOSITION_KEYS.forEach((k, i) => {
    out[k] = round(estimator === "mean_sample" ? plain[i]! / n : weighted[i]! / refSum, 3);
  });
  return out;
}

export type Granularity = "year" | "quarter" | "month";

export function bucketOf(date: string, g: Granularity): string {
  const y = date.slice(0, 4);
  const m = Number(date.slice(5, 7));
  if (g === "year") return y;
  if (g === "quarter") return `${y}-T${Math.ceil(m / 3)}`;
  return date.slice(0, 7);
}

export function bucketsBetween(from: string, to: string, g: Granularity): string[] {
  const out: string[] = [];
  for (let ym = from; ym <= to; ym = addMonths(ym, 1)) {
    const b = bucketOf(`${ym}-01`, g);
    if (out.at(-1) !== b) out.push(b);
  }
  return out;
}

export interface SeriesPoint {
  bucket: string;
  n: number;
  circuits: number;
  value: number | null;
  p25: number | null;
  p75: number | null;
}

/** Time series with explicit empty buckets (value = null, never interpolated). */
export function timeSeries(recs: Characterization[], from: string, to: string, g: Granularity, estimator: Estimator): SeriesPoint[] {
  const groups = groupInto(recs, (r) => (r.dates.sampling ? bucketOf(r.dates.sampling, g) : null));
  return bucketsBetween(from, to, g).map((bucket) => {
    const rs = groups.get(bucket) ?? [];
    const agg = aggregateImpropis(rs, estimator);
    const vals = rs.map((r) => r.derived.impropisPct!).filter((v) => v !== null);
    return {
      bucket,
      n: rs.length,
      circuits: agg.circuits,
      value: agg.value,
      p25: vals.length ? round(quantile(vals, 0.25)) : null,
      p75: vals.length ? round(quantile(vals, 0.75)) : null,
    };
  });
}

export interface GroupRow {
  key: string;
  label: string;
  n: number;
  circuits: number;
  value: number | null;
  median: number | null;
  sufficient: boolean;
}

export function groupBy(recs: Characterization[], keyFn: (r: Characterization) => string | null, labelFn: (key: string, rs: Characterization[]) => string, estimator: Estimator, minN: number): GroupRow[] {
  const groups = groupInto(recs, keyFn);
  return [...groups.entries()].map(([key, rs]) => {
    const agg = aggregateImpropis(rs, estimator);
    return {
      key,
      label: labelFn(key, rs),
      n: agg.n,
      circuits: agg.circuits,
      value: agg.value,
      median: agg.n ? round(median(rs.map((r) => r.derived.impropisPct!))) : null,
      sufficient: agg.n >= minN,
    };
  });
}

// ---------------------------------------------------------------- change analysis

export interface CircuitChange {
  circuitKey: string;
  circuitName: string;
  comarcaCode: string | null;
  nPrev: number;
  nCur: number;
  meanPrev: number;
  meanCur: number;
  diffPp: number;
  lo: number;
  hi: number;
  robust: boolean;
  topCategories: { key: ImproperKey; deltaPp: number }[];
  sampleIds: string[];
}

export interface ChangeAnalysis {
  windows: { prev: [string, string]; cur: [string, string] };
  minPerWindow: number;
  cohort: { circuits: number; nPrev: number; nCur: number; meanPrev: number | null; meanCur: number | null; diffPp: number | null };
  allSamples: { nPrev: number; nCur: number; meanPrev: number | null; meanCur: number | null; diffPp: number | null };
  categories: { key: ImproperKey; prev: number; cur: number; deltaPp: number }[];
  circuits: CircuitChange[];
  excludedCircuits: number;
}

const inRange = (d: string | null, a: string, b: string) => !!d && d.slice(0, 7) >= a && d.slice(0, 7) <= b;

function meanComposition(rs: Characterization[]): Record<ImproperKey, number> {
  return Object.fromEntries(IMPROPER_KEYS.map((k) => [k, rs.length ? mean(rs.map((r) => r.derived.composition?.[k] ?? 0)) : 0])) as Record<ImproperKey, number>;
}

/** Last `windowMonths` up to `to` versus the preceding window, per circuit and on a stable cohort. */
export function changeAnalysis(history: Characterization[], to: string, windowMonths = 12): ChangeAnalysis {
  const cur: [string, string] = [addMonths(to, -(windowMonths - 1)), to];
  const prev: [string, string] = [addMonths(to, -(2 * windowMonths - 1)), addMonths(to, -windowMonths)];
  const prevRs = history.filter((r) => inRange(r.dates.sampling, ...prev));
  const curRs = history.filter((r) => inRange(r.dates.sampling, ...cur));
  const byCircuit = (rs: Characterization[]) => groupInto(rs, (r) => r.circuitKey);
  const p = byCircuit(prevRs);
  const c = byCircuit(curRs);
  const cohortKeys = [...c.keys()].filter((k) => p.has(k));
  const cohortPrev = cohortKeys.flatMap((k) => p.get(k)!);
  const cohortCur = cohortKeys.flatMap((k) => c.get(k)!);
  const m = (rs: Characterization[]) => (rs.length ? round(mean(rs.map((r) => r.derived.impropisPct!))) : null);
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : round(b - a));

  const compPrev = meanComposition(cohortPrev);
  const compCur = meanComposition(cohortCur);
  const categories = IMPROPER_KEYS.map((k) => ({ key: k, prev: round(compPrev[k], 3), cur: round(compCur[k], 3), deltaPp: round(compCur[k] - compPrev[k], 3) })).sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp));

  let excludedCircuits = 0;
  const circuits: CircuitChange[] = [];
  for (const k of new Set([...p.keys(), ...c.keys()])) {
    const a = p.get(k) ?? [];
    const b = c.get(k) ?? [];
    if (a.length < MIN_SAMPLES_PER_WINDOW || b.length < MIN_SAMPLES_PER_WINDOW) {
      excludedCircuits++;
      continue;
    }
    const w = welch(a.map((r) => r.derived.impropisPct!), b.map((r) => r.derived.impropisPct!));
    const ca = meanComposition(a);
    const cb = meanComposition(b);
    circuits.push({
      circuitKey: k,
      circuitName: b[0]!.circuitName,
      comarcaCode: b[0]!.comarcaCode,
      nPrev: a.length,
      nCur: b.length,
      meanPrev: round(mean(a.map((r) => r.derived.impropisPct!))),
      meanCur: round(mean(b.map((r) => r.derived.impropisPct!))),
      diffPp: round(w.diff),
      lo: round(w.lo),
      hi: round(w.hi),
      robust: Number.isFinite(w.lo) && (w.lo > 0 || w.hi < 0),
      topCategories: IMPROPER_KEYS.map((key) => ({ key, deltaPp: round(cb[key] - ca[key]) }))
        .sort((x, y) => Math.abs(y.deltaPp) - Math.abs(x.deltaPp))
        .slice(0, 3),
      sampleIds: [...a, ...b].map((r) => r.id),
    });
  }
  circuits.sort((x, y) => y.diffPp - x.diffPp);
  return {
    windows: { prev, cur },
    minPerWindow: MIN_SAMPLES_PER_WINDOW,
    cohort: { circuits: cohortKeys.length, nPrev: cohortPrev.length, nCur: cohortCur.length, meanPrev: m(cohortPrev), meanCur: m(cohortCur), diffPp: diff(m(cohortPrev), m(cohortCur)) },
    allSamples: { nPrev: prevRs.length, nCur: curRs.length, meanPrev: m(prevRs), meanCur: m(curRs), diffPp: diff(m(prevRs), m(curRs)) },
    categories,
    circuits,
    excludedCircuits,
  };
}

// ---------------------------------------------------------------- anomalies

export interface Anomaly {
  id: string;
  circuitKey: string;
  circuitName: string;
  date: string;
  value: number;
  baselineMedian: number;
  baselineMad: number;
  z: number;
  historyN: number;
  kind: "possible_error_dades" | "possible_incidencia_operativa";
  reasons: string[];
}

/**
 * Robust z-score of each in-scope sample against its circuit's history:
 * z = (x − median) / max(MAD, 0.5 pp). Median and MAD are computed once per
 * circuit over the whole comparable history; both are robust to the point itself.
 */
export function anomalies(history: Characterization[], targets: Characterization[]): Anomaly[] {
  const baselines = new Map<string, { med: number; spread: number; n: number }>();
  for (const [k, rs] of groupInto(history, (r) => r.circuitKey)) {
    if (rs.length < ANOMALY_MIN_HISTORY + 1) continue;
    const vals = rs.map((r) => r.derived.impropisPct!);
    baselines.set(k, { med: median(vals), spread: Math.max(mad(vals), 0.5), n: vals.length });
  }
  const out: Anomaly[] = [];
  for (const t of targets) {
    const b = baselines.get(t.circuitKey);
    if (!b) continue;
    const z = (t.derived.impropisPct! - b.med) / b.spread;
    if (Math.abs(z) < ANOMALY_Z) continue;
    const dataFlags = t.quality.filter((q) => ["Q02", "Q03", "Q04", "Q06", "Q09", "Q12"].includes(q.code));
    out.push({
      id: t.id,
      circuitKey: t.circuitKey,
      circuitName: t.circuitName,
      date: t.dates.sampling!,
      value: round(t.derived.impropisPct!),
      baselineMedian: round(b.med),
      baselineMad: round(b.spread),
      z: round(z, 1),
      historyN: b.n,
      kind: dataFlags.length ? "possible_error_dades" : "possible_incidencia_operativa",
      reasons: dataFlags.map((q) => `${q.code}: ${q.detail}`),
    });
  }
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

// ---------------------------------------------------------------- persistent changes

export interface PersistentChange {
  circuitKey: string;
  circuitName: string;
  recentMedian: number;
  baselineMedian: number;
  shiftPp: number;
  consistent: number;
  lastDate: string;
  sampleIds: string[];
}

/** Last 4 samples vs the 8 before: flags shifts that persist, not isolated spikes. */
export function persistentChanges(history: Characterization[], to: string): PersistentChange[] {
  const byCircuit = groupInto(history, (r) => (r.dates.sampling!.slice(0, 7) <= to ? r.circuitKey : null));
  const out: PersistentChange[] = [];
  for (const [k, rs] of byCircuit) {
    if (rs.length < 12) continue;
    const sorted = [...rs].sort((a, b) => a.dates.sampling!.localeCompare(b.dates.sampling!));
    const recent = sorted.slice(-4);
    const base = sorted.slice(-12, -4);
    const bv = base.map((r) => r.derived.impropisPct!);
    const rv = recent.map((r) => r.derived.impropisPct!);
    const bMed = median(bv);
    const bMad = Math.max(mad(bv), 0.5);
    const shift = median(rv) - bMed;
    const sameSide = rv.filter((v) => (shift > 0 ? v > bMed + bMad : v < bMed - bMad)).length;
    if (Math.abs(shift) >= Math.max(1, bMad) && sameSide >= 3) {
      out.push({
        circuitKey: k,
        circuitName: sorted.at(-1)!.circuitName,
        recentMedian: round(median(rv)),
        baselineMedian: round(bMed),
        shiftPp: round(shift),
        consistent: sameSide,
        lastDate: sorted.at(-1)!.dates.sampling!,
        sampleIds: [...base, ...recent].map((r) => r.id),
      });
    }
  }
  return out.sort((a, b) => b.shiftPp - a.shiftPp);
}

// ---------------------------------------------------------------- seasonality

export interface Seasonality {
  eligible: boolean;
  reason: string | null;
  byMonth: { month: number; n: number; mean: number | null; median: number | null }[];
  kruskal: { H: number; df: number; p: number; N: number } | null;
  amplitudePp: number | null;
}

export function seasonality(recs: Characterization[], minPerMonth = 5): Seasonality {
  const groups: number[][] = Array.from({ length: 12 }, () => []);
  for (const r of recs) groups[Number(r.dates.sampling!.slice(5, 7)) - 1]!.push(r.derived.impropisPct!);
  const byMonth = groups.map((g, i) => ({ month: i + 1, n: g.length, mean: g.length ? round(mean(g)) : null, median: g.length ? round(median(g)) : null }));
  const years = new Set(recs.map((r) => r.dates.sampling!.slice(0, 4)));
  const thin = byMonth.filter((m) => m.n < minPerMonth).length;
  if (years.size < 2) return { eligible: false, reason: "Cal com a mínim dos anys de dades en l'àmbit.", byMonth, kruskal: null, amplitudePp: null };
  if (thin > 2) return { eligible: false, reason: `${thin} mesos tenen menys de ${minPerMonth} mostres.`, byMonth, kruskal: null, amplitudePp: null };
  const means = byMonth.map((m) => m.mean).filter((x): x is number => x !== null);
  const kw = kruskalWallis(groups.filter((g) => g.length >= minPerMonth));
  return { eligible: true, reason: null, byMonth, kruskal: { ...kw, H: round(kw.H), p: kw.p }, amplitudePp: round(Math.max(...means) - Math.min(...means)) };
}

// ---------------------------------------------------------------- clustering

export const CLUSTER_METHOD =
  "Perfils de composició (FORM, FV, 11 categories d'impropi, pèrdues). Zeros substituïts per 0,005 pp (reemplaçament multiplicatiu) i transformació log-ràtio centrada (CLR); k-means (k=4, inicialització k-means++ amb llavor fixa 42, 50 iteracions). Exploratori: no implica tipologies reals.";

export interface ClusterResult {
  k: number;
  n: number;
  clusters: { id: number; size: number; profile: Record<CompositionKey, number>; distinctive: { key: CompositionKey; ratio: number }[]; topCircuits: { name: string; n: number }[]; sampleIds: string[] }[];
}

export function clusterProfiles(recs: Characterization[], k = 4): ClusterResult | null {
  const usable = recs.filter((r) => r.derived.composition);
  if (usable.length < k * 10) return null;
  const delta = 0.005;
  const D = COMPOSITION_KEYS.length;
  const n = usable.length;
  // CLR-transformed points in one flat typed array (n × D) — allocation-free inner loops.
  const X = new Float64Array(n * D);
  const raw = new Float64Array(D);
  for (let i = 0; i < n; i++) {
    const comp = usable[i]!.derived.composition!;
    let zeros = 0;
    let total = 0;
    for (let j = 0; j < D; j++) {
      const v = Math.max(0, comp[COMPOSITION_KEYS[j]!] ?? 0);
      raw[j] = v;
      total += v;
      if (v === 0) zeros++;
    }
    let g = 0;
    for (let j = 0; j < D; j++) {
      const adj = raw[j] === 0 ? delta : raw[j]! * (1 - (zeros * delta) / total);
      const l = Math.log(adj);
      X[i * D + j] = l;
      g += l;
    }
    g /= D;
    for (let j = 0; j < D; j++) X[i * D + j]! -= g;
  }
  const C = new Float64Array(k * D);
  const dist = (i: number, c: number) => {
    let d = 0;
    for (let j = 0; j < D; j++) {
      const t = X[i * D + j]! - C[c * D + j]!;
      d += t * t;
    }
    return d;
  };
  const setCenter = (c: number, i: number) => C.set(X.subarray(i * D, i * D + D), c * D);
  const rand = rng(42);
  setCenter(0, Math.floor(rand() * n));
  const dmin = new Float64Array(n).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      dmin[i] = Math.min(dmin[i]!, dist(i, c - 1));
      total += dmin[i]!;
    }
    let target = rand() * total;
    let idx = 0;
    while (target > dmin[idx]! && idx < n - 1) target -= dmin[idx++]!;
    setCenter(c, idx);
  }
  const assign = new Int32Array(n).fill(-1);
  const sums = new Float64Array(k * D);
  const counts = new Int32Array(k);
  for (let it = 0; it < 50; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = dist(i, c);
        if (dd < bd) {
          bd = dd;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        moved = true;
      }
    }
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = assign[i]!;
      counts[c]!++;
      for (let j = 0; j < D; j++) sums[c * D + j]! += X[i * D + j]!;
    }
    for (let c = 0; c < k; c++) if (counts[c]) for (let j = 0; j < D; j++) C[c * D + j] = sums[c * D + j]! / counts[c]!;
    if (!moved) break;
  }
  const overall = Object.fromEntries(COMPOSITION_KEYS.map((key) => [key, mean(usable.map((r) => r.derived.composition![key] ?? 0))])) as Record<CompositionKey, number>;
  const clusters = Array.from({ length: k }, (_, ci) => {
    const members = usable.filter((_, i) => assign[i] === ci);
    const profile = Object.fromEntries(COMPOSITION_KEYS.map((key) => [key, round(mean(members.map((r) => r.derived.composition![key] ?? 0)), 2)])) as Record<CompositionKey, number>;
    const distinctive = COMPOSITION_KEYS.filter((key) => key !== "form" && overall[key] > 0.05)
      .map((key) => ({ key, ratio: round(profile[key] / overall[key], 2) }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3);
    const circ = new Map<string, number>();
    for (const m of members) circ.set(m.circuitName, (circ.get(m.circuitName) ?? 0) + 1);
    return {
      id: ci + 1,
      size: members.length,
      profile,
      distinctive,
      topCircuits: [...circ.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, n })),
      sampleIds: members.map((m) => m.id),
    };
  })
    .sort((a, b) => a.profile.form - b.profile.form)
    .map((c, i) => ({ ...c, id: i + 1 }));
  return { k, n: usable.length, clusters };
}

// ---------------------------------------------------------------- intervention

export function beforeAfter(history: Characterization[], circuitKey: string, date: string, months = 12) {
  const rs = history.filter((r) => r.circuitKey === circuitKey);
  const ym = date.slice(0, 7);
  const pre = rs.filter((r) => inRange(r.dates.sampling, addMonths(ym, -months), addMonths(ym, -1)));
  const post = rs.filter((r) => r.dates.sampling! >= date && inRange(r.dates.sampling, ym, addMonths(ym, months - 1)));
  const enough = pre.length >= MIN_SAMPLES_PER_WINDOW && post.length >= MIN_SAMPLES_PER_WINDOW;
  const w = enough ? welch(pre.map((r) => r.derived.impropisPct!), post.map((r) => r.derived.impropisPct!)) : null;
  return {
    circuitKey,
    date,
    months,
    nPre: pre.length,
    nPost: post.length,
    meanPre: pre.length ? round(mean(pre.map((r) => r.derived.impropisPct!))) : null,
    meanPost: post.length ? round(mean(post.map((r) => r.derived.impropisPct!))) : null,
    diffPp: w ? round(w.diff) : null,
    lo: w ? round(w.lo) : null,
    hi: w ? round(w.hi) : null,
    enough,
    sampleIds: [...pre, ...post].map((r) => r.id),
    caveat: "Associació temporal; no demostra causalitat (canvis de recollida, estacionalitat i selecció de mostres poden explicar la diferència).",
  };
}

// ---------------------------------------------------------------- comparison

export function distribution(rs: Characterization[]) {
  const v = rs.map((r) => r.derived.impropisPct!).filter((x) => x !== null);
  if (!v.length) return null;
  return { n: v.length, min: round(Math.min(...v)), q1: round(quantile(v, 0.25)), median: round(median(v)), q3: round(quantile(v, 0.75)), max: round(Math.max(...v)), mean: round(mean(v)) };
}

/** Months between first and last sample of each entity intersected → common period. */
export function commonPeriod(groups: Characterization[][]): [string, string] | null {
  if (!groups.length || groups.some((g) => !g.length)) return null;
  const starts = groups.map((g) => g.reduce((a, r) => (r.dates.sampling! < a ? r.dates.sampling! : a), "9999"));
  const ends = groups.map((g) => g.reduce((a, r) => (r.dates.sampling! > a ? r.dates.sampling! : a), "0000"));
  const from = starts.sort().at(-1)!.slice(0, 7);
  const to = ends.sort()[0]!.slice(0, 7);
  return from <= to ? [from, to] : null;
}
