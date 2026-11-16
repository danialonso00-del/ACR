/** Small, dependency-free statistics helpers. All functions ignore nothing: callers filter nulls. */

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export const median = (xs: number[]) => quantile(xs, 0.5);

/** Median absolute deviation scaled to be consistent with σ under normality. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
}

/** Student t quantile (two-sided 95 %) via a Cornish–Fisher style approximation; adequate for df ≥ 2. */
export function t975(df: number): number {
  if (!Number.isFinite(df) || df <= 0) return NaN;
  const z = 1.959964;
  const g1 = (z ** 3 + z) / 4;
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
  const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;
  return z + g1 / df + g2 / df ** 2 + g3 / df ** 3;
}

/** Welch difference of means (b − a) with an approximate 95 % interval. */
export function welch(a: number[], b: number[]) {
  const va = variance(a) / a.length;
  const vb = variance(b) / b.length;
  const diff = mean(b) - mean(a);
  const se = Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  const t = t975(df);
  return { diff, se, df, lo: diff - t * se, hi: diff + t * se };
}

// Regularised lower incomplete gamma P(a, x) (series / continued fraction), for χ² p-values.
function lnGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0]!;
  for (let i = 1; i < g + 2; i++) x += c[i]! / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sumv = 1 / a;
    let del = sumv;
    for (let n = 1; n < 500; n++) {
      del *= x / (a + n);
      sumv += del;
      if (Math.abs(del) < Math.abs(sumv) * 1e-12) break;
    }
    return sumv * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  let b = x + 1 - a;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

export const chiSquareSf = (x: number, df: number) => 1 - gammaP(df / 2, x / 2);

/** Kruskal–Wallis H test across groups (tie-corrected). */
export function kruskalWallis(groups: number[][]) {
  const g = groups.filter((x) => x.length > 0);
  const all = g.flatMap((xs, gi) => xs.map((v) => ({ v, gi }))).sort((a, b) => a.v - b.v);
  const N = all.length;
  const ranks = new Array<number>(N);
  let tieSum = 0;
  for (let i = 0; i < N; ) {
    let j = i;
    while (j + 1 < N && all[j + 1]!.v === all[i]!.v) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[k] = r;
    const t = j - i + 1;
    tieSum += t ** 3 - t;
    i = j + 1;
  }
  const rankSums = new Array<number>(g.length).fill(0);
  all.forEach((x, i) => (rankSums[x.gi]! += ranks[i]!));
  let H = (12 / (N * (N + 1))) * sum(rankSums.map((R, i) => R ** 2 / g[i]!.length)) - 3 * (N + 1);
  const corr = 1 - tieSum / (N ** 3 - N);
  if (corr > 0) H /= corr;
  const df = g.length - 1;
  return { H, df, p: df > 0 ? chiSquareSf(H, df) : NaN, N };
}

/** Deterministic PRNG (mulberry32) for reproducible clustering and synthetic data. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round = (x: number, d = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);
