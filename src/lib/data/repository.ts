import "server-only";
/**
 * Server-side dataset access. Datasets are loaded from disk once per process
 * and cached. Modes are never mixed: callers always ask for one mode.
 *
 * Production note: this in-memory adapter keeps the demo reproducible without
 * services. db/schema.sql describes the PostgreSQL target behind the same API.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Characterization, Dataset, DatasetMeta, DataMode, PhotoRecord } from "./types";

const ROOT = process.cwd();
const SNAPSHOTS = path.join(ROOT, "data", "snapshots");
export const RUNTIME_DIR = path.join(ROOT, "data", "runtime");

interface Loaded extends Dataset {
  byId: Map<string, Characterization>;
  photoChecks: Map<string, { photos: number; capturedAt: string; error?: string }>;
  circuits: CircuitInfo[];
}

export interface CircuitInfo {
  key: string;
  name: string;
  titular: string | null;
  label: string;
  comarcaCode: string | null;
  attribution: Characterization["attribution"];
  municipalities: string[];
  n: number;
  first: string | null;
  last: string | null;
}

const g = globalThis as unknown as { __arcDatasets?: Map<string, Loaded> };
const cache = (g.__arcDatasets ??= new Map());

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

function finalize(meta: DatasetMeta, records: Characterization[], photos: PhotoRecord[], checks: { bulletinId: string; photos: number; capturedAt: string; error?: string }[]): Loaded {
  const byId = new Map(records.map((r) => [r.id, r]));
  const groups = new Map<string, Characterization[]>();
  for (const r of records) {
    const list = groups.get(r.circuitKey);
    if (list) list.push(r);
    else groups.set(r.circuitKey, [r]);
  }
  const nameCount = new Map<string, number>();
  for (const rs of groups.values()) nameCount.set(rs[0]!.circuitName, (nameCount.get(rs[0]!.circuitName) ?? 0) + 1);
  const circuits: CircuitInfo[] = [...groups.entries()].map(([key, rs]) => {
    const last = rs.reduce<Characterization>((a, r) => ((r.dates.sampling ?? "") > (a.dates.sampling ?? "") ? r : a), rs[0]!);
    const dates = rs.map((r) => r.dates.sampling).filter((d): d is string => !!d).sort();
    const dup = (nameCount.get(last.circuitName) ?? 0) > 1;
    return {
      key,
      name: last.circuitName,
      titular: last.titular,
      label: dup && last.titular ? `${last.circuitName} · ${last.titular}` : last.circuitName,
      comarcaCode: last.comarcaCode,
      attribution: last.attribution,
      municipalities: last.municipalities.map((m) => m.name ?? m.raw),
      n: rs.length,
      first: dates[0] ?? null,
      last: dates.at(-1) ?? null,
    };
  });
  circuits.sort((a, b) => a.label.localeCompare(b.label, "ca"));
  return {
    meta,
    records,
    photos,
    byId,
    photoChecks: new Map(checks.map((c) => [c.bulletinId, c])),
    circuits,
  };
}

function loadSnapshot(dir: string): Loaded | null {
  const metaFile = path.join(dir, "meta.json");
  const recFile = path.join(dir, "records.json.gz");
  if (!existsSync(metaFile) || !existsSync(recFile)) return null;
  const meta = readJson<DatasetMeta>(metaFile, null as never);
  const records = JSON.parse(gunzipSync(readFileSync(recFile)).toString("utf8")) as Characterization[];
  const photos = readJson<PhotoRecord[]>(path.join(dir, "photos.json"), []);
  const checks = readJson<{ bulletinId: string; photos: number; capturedAt: string; error?: string }[]>(path.join(dir, "photo-checks.json"), []);
  return finalize(meta, records, photos, checks);
}

export function listImports(): { id: string; label: string; builtAt: string; recordCount: number }[] {
  const dir = path.join(RUNTIME_DIR, "imports");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => /^[a-z0-9-]{1,64}$/.test(d) && existsSync(path.join(dir, d, "meta.json")))
    .map((d) => {
      const m = readJson<DatasetMeta>(path.join(dir, d, "meta.json"), null as never);
      return { id: d, label: m.label, builtAt: m.builtAt, recordCount: m.recordCount };
    })
    .sort((a, b) => b.builtAt.localeCompare(a.builtAt));
}

export function getDataset(mode: DataMode, importId?: string): Loaded | null {
  let key: string = mode;
  let dir: string;
  if (mode === "imported") {
    const id = importId ?? listImports()[0]?.id;
    if (!id || !/^[a-z0-9-]{1,64}$/.test(id)) return null;
    key = `imported:${id}`;
    dir = path.join(RUNTIME_DIR, "imports", id);
  } else dir = path.join(SNAPSHOTS, mode);
  const hit = cache.get(key);
  if (hit) return hit;
  const loaded = loadSnapshot(dir);
  if (loaded) cache.set(key, loaded);
  return loaded;
}

export function invalidateDataset(key: string) {
  cache.delete(key);
}

export type LoadedDataset = Loaded;
