/**
 * Municipality name resolution against the ICGC municipality list.
 * SDR names are upper-case and drop leading articles ("GARRIGA" ↔ "la Garriga").
 * Matching is exact on a normalised key; anything else stays unresolved and is flagged.
 */
import type { MunicipalityRef } from "./types";

export interface MunicipalityEntry {
  code: string;
  name: string;
  comarcaCode: string;
  comarcaName: string;
}

export function municipalityKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/·/g, "")
    .replace(/^(ELS|LES|ETH|ERA|ES|EL|LA|L')(\s+|(?<=L'))/u, "")
    .replace(/,\s*(ELS|LES|ETH|ERA|ES|EL|LA|L')$/u, "")
    .replace(/['’\-]/g, " ")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Explicit aliases for official name changes and abbreviations found in the SDR.
 * Each entry must point to the current ICGC name; never add fuzzy matches here.
 */
export const MUNICIPALITY_ALIASES: Record<string, string> = {
  "SANT CARLES DE LA RAPITA": "la Ràpita", // renamed 2023
  "CASTELL PLATJA D ARO": "Castell d'Aro, Platja d'Aro i s'Agaró", // renamed 2021
  "CRUILLES": "Cruïlles, Monells i Sant Sadurní de l'Heura", // abbreviated in SDR
  "MONELLS I SSADURNI DE L HEURA": "Cruïlles, Monells i Sant Sadurní de l'Heura",
};

export class MunicipalityIndex {
  private byKey = new Map<string, MunicipalityEntry[]>();

  constructor(entries: MunicipalityEntry[]) {
    for (const e of entries) {
      const k = municipalityKey(e.name);
      const list = this.byKey.get(k) ?? [];
      list.push(e);
      this.byKey.set(k, list);
    }
  }

  resolve(raw: string): MunicipalityRef {
    const key = municipalityKey(raw);
    const alias = MUNICIPALITY_ALIASES[key];
    const hits = this.byKey.get(alias ? municipalityKey(alias) : key);
    if (hits && hits.length === 1) {
      const h = hits[0]!;
      return { raw, code: h.code, name: h.name, comarcaCode: h.comarcaCode };
    }
    return { raw, code: null, name: null, comarcaCode: null };
  }

  /** "A, B, C" → refs. The SDR uses ", " between municipalities. */
  resolveList(raw: string | null | undefined): MunicipalityRef[] {
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => this.resolve(s));
  }
}
