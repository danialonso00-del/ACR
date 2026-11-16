import "server-only";
/**
 * Photo access for bulletins. Order of resolution:
 *   1. bounded index built by `npm run ingest:photos` (snapshot),
 *   2. live read of the public gallery page (only for bulletin ids present in
 *      the loaded dataset; rate-limited; cached on disk for 7 days),
 *   3. honest "unavailable" state. Never substitutes stock images.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodeLatin, sdrRequest, SdrError } from "./http";
import { parseGalleryHtml } from "./html-parsers";
import type { LoadedDataset } from "@/lib/data/repository";
import type { PhotoRecord } from "@/lib/data/types";

const CACHE = path.join(process.cwd(), "data", "cache");
const GALLERY_TTL_MS = 7 * 24 * 3600 * 1000;
const IMAGE_MIN_INTERVAL_MS = Number(process.env.SDR_IMAGE_MIN_INTERVAL_MS ?? 250);
export const liveEnabled = () => process.env.SDR_LIVE !== "0";

export type GalleryResult =
  | { status: "indexed" | "live" | "cached"; photos: PhotoRecord[]; capturedAt: string }
  | { status: "synthetic" | "unavailable" | "disabled" | "unknown_bulletin"; photos: []; message: string };

const knownImages = new Set<string>();

function rememberImages(photos: PhotoRecord[]) {
  for (const p of photos) knownImages.add(p.imageId);
}

export async function getGallery(ds: LoadedDataset, bulletinId: string): Promise<GalleryResult> {
  if (ds.meta.mode === "synthetic_demo") return { status: "synthetic", photos: [], message: "Les dades sintètiques no tenen fotografies associades." };
  if (!/^\d{1,9}$/.test(bulletinId) || !ds.byId.has(bulletinId)) return { status: "unknown_bulletin", photos: [], message: "Butlletí no present al conjunt carregat." };

  const indexed = ds.photos.filter((p) => p.bulletinId === bulletinId);
  const check = ds.photoChecks.get(bulletinId);
  if (check) {
    rememberImages(indexed);
    return { status: "indexed", photos: indexed, capturedAt: check.capturedAt };
  }
  const cacheFile = path.join(CACHE, "galleries", `${bulletinId}.json`);
  if (existsSync(cacheFile)) {
    const c = JSON.parse(readFileSync(cacheFile, "utf8")) as { capturedAt: string; photos: PhotoRecord[] };
    if (Date.now() - Date.parse(c.capturedAt) < GALLERY_TTL_MS) {
      rememberImages(c.photos);
      return { status: "cached", photos: c.photos, capturedAt: c.capturedAt };
    }
  }
  if (!liveEnabled()) return { status: "disabled", photos: [], message: "Lectura en viu del SDR desactivada (SDR_LIVE=0) i galeria no indexada." };
  try {
    const res = await sdrRequest(`/cform/EditCaracteritzacionsImatges.do?caractId=${bulletinId}`, { method: "GET", timeoutMs: 30_000, maxBytes: 5_000_000, retries: 1 });
    const photos = parseGalleryHtml(decodeLatin(res.body), bulletinId, res.fetchedAt);
    mkdirSync(path.dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ capturedAt: res.fetchedAt, url: res.url, photos }));
    rememberImages(photos);
    return { status: "live", photos, capturedAt: res.fetchedAt };
  } catch (err) {
    const e = err as SdrError;
    return { status: "unavailable", photos: [], message: `No s'ha pogut llegir la galeria pública (${e.kind ?? "error"}). Pot ser un problema de connexió o de disponibilitat de la font.` };
  }
}

export function isKnownImage(ds: LoadedDataset, imageId: string): boolean {
  if (knownImages.has(imageId)) return true;
  if (ds.photos.some((p) => p.imageId === imageId)) {
    knownImages.add(imageId);
    return true;
  }
  return false;
}

export function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  return null;
}

/** Fetches (or reads from cache) one image; files are stored once per content hash. */
export async function getImage(imageId: string, size: "thumb" | "full"): Promise<{ body: Buffer; type: string; sha256: string; cached: boolean }> {
  const idxFile = path.join(CACHE, "photos", "index.json");
  const index: Record<string, { sha256: string; type: string }> = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, "utf8")) : {};
  const key = `${imageId}:${size}`;
  const hit = index[key];
  if (hit) {
    const f = path.join(CACHE, "photos", "by-hash", hit.sha256);
    if (existsSync(f)) return { body: readFileSync(f), type: hit.type, sha256: hit.sha256, cached: true };
  }
  if (!liveEnabled()) throw new SdrError("Live SDR access disabled", "blocked_host");
  const url = size === "thumb" ? `/cform/GetImatge.do?imatgeId=${imageId}&thumbNail=true` : `/cform/GetImatge.do?thumbNail=false&imatgeId=${imageId}`;
  // Images are fetched on demand when a person views them (never in bulk) and cached by hash.
  const res = await sdrRequest(url, { method: "GET", timeoutMs: 30_000, maxBytes: 15_000_000, retries: 1, minIntervalMs: IMAGE_MIN_INTERVAL_MS });
  const type = sniffImageType(res.body);
  if (!type) throw new SdrError("Response is not a recognised image", "http", 415);
  const sha256 = createHash("sha256").update(res.body).digest("hex");
  const dir = path.join(CACHE, "photos", "by-hash");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, sha256);
  if (!existsSync(f)) writeFileSync(f, res.body);
  index[key] = { sha256, type };
  writeFileSync(idxFile, JSON.stringify(index));
  return { body: res.body, type, sha256, cached: false };
}
