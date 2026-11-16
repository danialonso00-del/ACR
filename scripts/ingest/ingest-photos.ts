/**
 * Bounded photo-index job. Reads the public gallery page of selected bulletins
 * (ids taken from loaded records, never enumerated) and records image ids and
 * the photo type assigned in the SDR. Image bytes are NOT downloaded here:
 * the app proxies and caches them on demand (rights not confirmed).
 *
 *   npm run ingest:photos -- --recent 60 --per-year 3 [--bulletins 31301,31300] [--refresh]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { sdrRequest } from "../../src/lib/sdr/http";
import { parseGalleryHtml } from "../../src/lib/sdr/html-parsers";
import type { Characterization, PhotoRecord } from "../../src/lib/data/types";
import { latestCapture, readRaw, storeRaw } from "./raw-store";

const OUT = path.resolve("data/snapshots/public_snapshot/photos.json");

async function main() {
  const args = process.argv.slice(2);
  const get = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const recent = Number(get("--recent") ?? 60);
  const perYear = Number(get("--per-year") ?? 3);
  const explicit = (get("--bulletins") ?? "").split(",").filter(Boolean);
  const refresh = args.includes("--refresh");

  const records = JSON.parse(gunzipSync(readFileSync("data/snapshots/public_snapshot/records.json.gz")).toString()) as Characterization[];
  const bySampling = [...records].filter((r) => r.dates.sampling).sort((a, b) => b.dates.sampling!.localeCompare(a.dates.sampling!));
  const chosen = new Set<string>(explicit);
  bySampling.slice(0, recent).forEach((r) => chosen.add(r.id));
  // Deterministic spread across loaded years to measure historical availability.
  const years = [...new Set(records.map((r) => r.bulletinYear))].filter((y): y is number => y !== null);
  for (const y of years) {
    const ofYear = records.filter((r) => r.bulletinYear === y).sort((a, b) => Number(a.id) - Number(b.id));
    for (let i = 0; i < perYear && ofYear.length; i++) chosen.add(ofYear[Math.floor(((i + 0.5) * ofYear.length) / perYear)]!.id);
  }
  if (chosen.size > 200) throw new Error(`Refusing to index ${chosen.size} galleries in one run (limit 200).`);

  const existing: PhotoRecord[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const byBulletin = new Map<string, PhotoRecord[]>();
  for (const p of existing) byBulletin.set(p.bulletinId, [...(byBulletin.get(p.bulletinId) ?? []), p]);
  const checked: { bulletinId: string; photos: number; capturedAt: string; error?: string }[] = [];

  for (const id of chosen) {
    let cap = refresh ? undefined : latestCapture("gallery_html", id);
    try {
      if (!cap) {
        const url = `/cform/EditCaracteritzacionsImatges.do?caractId=${encodeURIComponent(id)}`;
        const res = await sdrRequest(url, { method: "GET", timeoutMs: 60_000, maxBytes: 5_000_000 });
        cap = storeRaw(
          { kind: "gallery_html", key: id, url: res.url, method: "GET", params: { caractId: id }, capturedAt: res.fetchedAt, contentType: res.contentType, contentDisposition: res.contentDisposition, status: res.status },
          res.body,
          "html",
        );
      }
      const html = new TextDecoder("windows-1252").decode(readRaw(cap));
      const photos = parseGalleryHtml(html, id, cap.capturedAt);
      byBulletin.set(id, photos);
      checked.push({ bulletinId: id, photos: photos.length, capturedAt: cap.capturedAt });
      console.log(`[ok] ${id}: ${photos.length} photos`);
    } catch (err) {
      checked.push({ bulletinId: id, photos: 0, capturedAt: new Date().toISOString(), error: (err as Error).message });
      console.error(`[error] ${id}: ${(err as Error).message}`);
    }
  }

  const all = [...byBulletin.values()].flat().sort((a, b) => Number(b.bulletinId) - Number(a.bulletinId) || a.order - b.order);
  writeFileSync(OUT, JSON.stringify(all, null, 1));
  const checkedPath = path.resolve("data/snapshots/public_snapshot/photo-checks.json");
  const prevChecks = existsSync(checkedPath) ? (JSON.parse(readFileSync(checkedPath, "utf8")) as typeof checked) : [];
  const merged = new Map(prevChecks.map((c) => [c.bulletinId, c]));
  for (const c of checked) merged.set(c.bulletinId, c);
  writeFileSync(checkedPath, JSON.stringify([...merged.values()], null, 1));
  console.log(`galleries checked: ${merged.size}; photos indexed: ${all.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
