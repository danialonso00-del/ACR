import { MunicipalityIndex } from "@/lib/data/municipalities";
import { normalizeRow } from "@/lib/data/normalize";
import type { Characterization } from "@/lib/data/types";

export const index = new MunicipalityIndex([
  { code: "080001", name: "Poble A", comarcaCode: "41", comarcaName: "Vallès Oriental" },
  { code: "080002", name: "Poble B", comarcaCode: "41", comarcaName: "Vallès Oriental" },
  { code: "170001", name: "la Vila C", comarcaCode: "02", comarcaName: "Alt Empordà" },
]);

/** Builds a record through the real normalisation pipeline (comma decimals, dd/mm/yyyy). */
export function rec(over: Record<string, string> = {}): Characterization {
  const values: Record<string, string> = {
    bulletinId: "1",
    circuitName: "CIRCUIT-1",
    titular: "AJUNTAMENT",
    municipalitiesRaw: "POBLE A",
    samplingDate: "15/03/2025",
    sampleKg: "250,00",
    "kg.total": "249,50",
    "kg.perdues": "0,50",
    "kg.vidre": "2,00",
    "factor.vidre": "1,00",
    "kg.paper": "3,00",
    "factor.paper": "0,66",
    "kg.plastic": "5,00",
    "factor.plastic": "1,00",
    "kg.altres": "0,00",
    "factor.altres": "1,00",
    "kg.totalImpropis": "10,00",
    ...over,
  };
  const r = normalizeRow(values, 2, { mode: "synthetic_demo", snapshotId: "test", municipalities: index, source: { file: null, sha256: null, url: null, capturedAt: null } });
  if (!r) throw new Error("normalizeRow returned null");
  return r;
}
