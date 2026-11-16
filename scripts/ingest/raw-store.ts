/**
 * Immutable raw layer: every capture is stored once by content hash and
 * recorded in a manifest with URL, parameters, capture date and HTTP metadata.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const RAW_DIR = path.resolve("data/raw/sdr");
const MANIFEST = path.join(RAW_DIR, "manifest.json");

export interface RawCapture {
  kind: "export_csv" | "list_html" | "gallery_html";
  key: string; // year for exports/lists, bulletin id for galleries
  file: string; // relative to RAW_DIR
  sha256: string;
  bytes: number;
  url: string;
  method: "GET" | "POST";
  params: Record<string, string>;
  capturedAt: string;
  contentType: string | null;
  contentDisposition: string | null;
  status: number;
  note?: string;
}

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function readManifest(): RawCapture[] {
  if (!existsSync(MANIFEST)) return [];
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as RawCapture[];
}

function writeManifest(entries: RawCapture[]) {
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2));
}

export function storeRaw(
  meta: Omit<RawCapture, "file" | "sha256" | "bytes">,
  body: Buffer,
  ext: string,
): RawCapture {
  const hash = sha256(body);
  const rel = path.posix.join(meta.kind, meta.key, `${hash.slice(0, 16)}.${ext}`);
  const abs = path.join(RAW_DIR, rel);
  if (!existsSync(abs)) {
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body, { flag: "wx" }); // never overwrite
  }
  const entry: RawCapture = { ...meta, file: rel, sha256: hash, bytes: body.byteLength };
  const manifest = readManifest();
  manifest.push(entry);
  writeManifest(manifest);
  return entry;
}

export function latestCapture(kind: RawCapture["kind"], key: string): RawCapture | undefined {
  return readManifest()
    .filter((c) => c.kind === kind && c.key === key)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .at(-1);
}

export function readRaw(capture: RawCapture): Buffer {
  return readFileSync(path.join(RAW_DIR, capture.file));
}
