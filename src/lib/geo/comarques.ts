import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DataMode } from "@/lib/data/types";

export interface ComarcaShape {
  code: string;
  name: string;
  capital: string;
  centroid: [number, number];
  path: string;
}

export interface GeoLayer {
  kind: "icgc" | "fictitious";
  source: string;
  sourceUrl: string | null;
  viewBox: [number, number, number, number];
  shapes: ComarcaShape[];
}

let icgc: GeoLayer | null = null;

export function getGeo(mode: DataMode): GeoLayer {
  if (mode === "synthetic_demo") return fictitiousLayer();
  if (!icgc) {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "data", "geo", "comarques.json"), "utf8"));
    icgc = { kind: "icgc", source: raw.source, sourceUrl: raw.sourceUrl, viewBox: raw.viewBox, shapes: raw.comarques };
  }
  return icgc;
}

/** Schematic hexagon tiles for fictitious territories: never drawn over the real map. */
function fictitiousLayer(): GeoLayer {
  const codes = ["D1", "D2", "D3", "D4", "D5", "D6"];
  const hex = (cx: number, cy: number, r: number) =>
    "M" + Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join("L") + "Z";
  const pos: [number, number][] = [[250, 220], [430, 220], [610, 220], [340, 375], [520, 375], [700, 375]];
  return {
    kind: "fictitious",
    source: "Teselles esquemàtiques de territoris fictius (dades sintètiques)",
    sourceUrl: null,
    viewBox: [100, 100, 760, 400],
    shapes: codes.map((code, i) => ({ code, name: `Territori Fictici ${code}`, capital: "—", centroid: pos[i]!, path: hex(pos[i]![0], pos[i]![1], 100) })),
  };
}

export function comarcaNames(mode: DataMode): Map<string, string> {
  return new Map(getGeo(mode).shapes.map((s) => [s.code, s.name]));
}
