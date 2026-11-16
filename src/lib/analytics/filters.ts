/**
 * Global analysis scope. Persisted in the URL; every metric, chart, map,
 * table, export and assistant tool receives the same parsed object.
 */
import { z } from "zod";
import type { DataMode } from "@/lib/data/types";

export const ESTIMATORS = ["mean_sample", "mass_ratio"] as const;
export type Estimator = (typeof ESTIMATORS)[number];

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const FiltersSchema = z.object({
  mode: z.enum(["public_snapshot", "imported", "synthetic_demo"]).default("public_snapshot"),
  importId: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
  from: month.optional(),
  to: month.optional(),
  comarca: z.string().regex(/^[0-9A-Z-]{1,8}$/).optional(),
  circuit: z.string().max(300).optional(),
  stream: z.enum(["FORM", "RESTA", "REBUIG"]).default("FORM"),
  formType: z.string().max(80).optional(),
  collectionType: z.string().max(80).optional(),
  estimator: z.enum(ESTIMATORS).default("mean_sample"),
  lowMass: z.enum(["exclude", "include"]).default("exclude"),
  minN: z.coerce.number().int().min(1).max(100).default(5),
});
export type Filters = z.infer<typeof FiltersSchema>;

export const FILTER_KEYS = Object.keys(FiltersSchema.shape) as (keyof Filters)[];

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseFilters(src: ParamSource): Filters {
  const obj: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const v = src instanceof URLSearchParams ? src.get(key) : src[key];
    const s = Array.isArray(v) ? v[0] : v;
    if (s !== undefined && s !== null && s !== "") obj[key] = s;
  }
  const parsed = FiltersSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  // Drop invalid keys one by one instead of failing the whole page.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  for (const k of bad) delete obj[k];
  return FiltersSchema.parse(obj);
}

const DEFAULTS = FiltersSchema.parse({});

export function filtersToQuery(f: Partial<Filters>, overrides: Partial<Filters> = {}): string {
  const merged = { ...f, ...overrides } as Record<string, unknown>;
  const params = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = merged[k];
    if (v === undefined || v === null || v === "") continue;
    if (DEFAULTS[k] === v) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function describeMode(mode: DataMode): string {
  return mode === "public_snapshot" ? "Extracte públic SDR" : mode === "imported" ? "Dades importades" : "Dades sintètiques de demostració";
}

/** "2025-03" → [start ISO date, end ISO date] inclusive. */
export function monthBounds(from?: string, to?: string): [string | null, string | null] {
  const start = from ? `${from}-01` : null;
  let end: string | null = null;
  if (to) {
    const [y, m] = to.split("-").map(Number) as [number, number];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    end = `${to}-${String(last).padStart(2, "0")}`;
  }
  return [start, end];
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
