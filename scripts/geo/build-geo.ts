/**
 * Builds the comarca map and the municipality lookup from the official ICGC
 * WFS "divisions administratives" service (scale 1:1,000,000).
 *
 *   npm run build:geo            # uses cached raw GML when present
 *   npm run build:geo -- --refresh
 *
 * Output:
 *   data/geo/comarques.json  – simplified SVG paths (pre-projected), centroid, code, name
 *   data/geo/municipis.json  – INE/Idescat code, name, comarca code (no geometry)
 *   data/raw/icgc/*.gml       – immutable raw downloads + manifest.json
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const WFS =
  "https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&srsName=EPSG:4326&typeNames=divisions_administratives_wfs:divisions_administratives_";
const RAW_DIR = path.resolve("data/raw/icgc");
const OUT_DIR = path.resolve("data/geo");

async function getRaw(layer: string, refresh: boolean): Promise<string> {
  const file = path.join(RAW_DIR, `${layer}.gml`);
  if (!refresh && existsSync(file)) return readFileSync(file, "utf8");
  const url = `${WFS}${layer}`;
  const res = await fetch(url, { headers: { "User-Agent": "ARC-Intelligencia-Residus-Demo/0.1 (MTI technology demo)" } });
  if (!res.ok) throw new Error(`ICGC WFS ${layer}: HTTP ${res.status}`);
  const text = await res.text();
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(file, text);
  const manifestPath = path.join(RAW_DIR, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
  manifest.push({
    layer,
    url,
    capturedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(text).digest("hex"),
    bytes: Buffer.byteLength(text),
    licence: "ICGC — CC BY 4.0 (verify on icgc.cat before redistribution)",
  });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return text;
}

type Ring = [number, number][]; // [lon, lat]

function parseFeatures(gml: string, layer: string) {
  const members = gml.split("<wfs:member>").slice(1);
  return members.map((m) => {
    const prop = (name: string) =>
      m.match(new RegExp(`<divisions_administratives_wfs:${name}>([^<]*)<`))?.[1]?.trim() ?? "";
    const polygons: Ring[][] = [];
    for (const poly of m.split("<gml:Polygon").slice(1)) {
      const rings: Ring[] = [];
      for (const pl of poly.matchAll(/<gml:posList>([^<]+)<\/gml:posList>/g)) {
        const nums = pl[1]!.trim().split(/\s+/).map(Number);
        const ring: Ring = [];
        for (let i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i + 1]!, nums[i]!]); // EPSG:4326 axis order lat lon
        rings.push(ring);
      }
      polygons.push(rings);
    }
    return { layer, prop, polygons };
  });
}

// Douglas–Peucker simplification on projected coordinates.
function simplify(points: [number, number][], tol: number): [number, number][] {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [x1, y1] = points[s]!;
    const [x2, y2] = points[e]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = points[i]!;
      // Closed rings start and end on the same point: fall back to point distance.
      const d = len < 1e-9 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const comGml = await getRaw("comarques_1000000", refresh);
  const munGml = await getRaw("municipis_1000000", refresh);
  const comarques = parseFeatures(comGml, "comarques");
  const municipis = parseFeatures(munGml, "municipis");

  // Equirectangular projection with cos(lat0) correction: adequate for a region of ~300 km.
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of comarques)
    for (const poly of f.polygons)
      for (const [lon, lat] of poly[0] ?? []) {
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const width = 1000;
  const scale = width / ((maxLon - minLon) * k);
  const height = Math.round((maxLat - minLat) * scale);
  const project = ([lon, lat]: [number, number]): [number, number] => [
    (lon - minLon) * k * scale,
    (maxLat - lat) * scale,
  ];

  const out = comarques.map((f) => {
    let d = "";
    let area = 0, cx = 0, cy = 0;
    for (const poly of f.polygons) {
      for (const ring of poly) {
        const pts = simplify(ring.map(project), 0.6);
        if (pts.length < 3) continue;
        d += "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
      }
      // centroid of the outer ring (area-weighted across polygons)
      const outer = (poly[0] ?? []).map(project);
      for (let i = 0; i < outer.length - 1; i++) {
        const [x0, y0] = outer[i]!;
        const [x1, y1] = outer[i + 1]!;
        const cross = x0 * y1 - x1 * y0;
        area += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
      }
    }
    return {
      code: f.prop("CODICOMAR"),
      name: f.prop("NOMCOMAR"),
      capital: f.prop("CAPCOMAR"),
      centroid: [Number((cx / (3 * area)).toFixed(1)), Number((cy / (3 * area)).toFixed(1))],
      path: d,
    };
  });

  const muni = municipis.map((f) => ({
    code: f.prop("CODIMUNI"),
    name: f.prop("NOMMUNI"),
    comarcaCode: f.prop("CODICOMAR"),
    comarcaName: f.prop("NOMCOMAR"),
    provincia: f.prop("NOMPROV"),
  }));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, "comarques.json"),
    JSON.stringify({
      source: "ICGC WFS divisions_administratives_comarques_1000000",
      sourceUrl: `${WFS}comarques_1000000`,
      builtAt: new Date().toISOString(),
      viewBox: [0, 0, width, height],
      comarques: out.sort((a, b) => a.code.localeCompare(b.code)),
    }),
  );
  writeFileSync(
    path.join(OUT_DIR, "municipis.json"),
    JSON.stringify({
      source: "ICGC WFS divisions_administratives_municipis_1000000",
      builtAt: new Date().toISOString(),
      municipis: muni.sort((a, b) => a.name.localeCompare(b.name, "ca")),
    }),
  );
  const size = Buffer.byteLength(readFileSync(path.join(OUT_DIR, "comarques.json")));
  console.log(`comarques: ${out.length} (${(size / 1024).toFixed(0)} KB), municipis: ${muni.length}, viewBox 0 0 ${width} ${height}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
