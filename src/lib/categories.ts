import type { CompositionKey, ImproperKey } from "@/lib/data/types";

export const CATEGORY_LABEL: Record<CompositionKey, string> = {
  form: "FORM",
  fv: "Fracció vegetal (poda)",
  vidre: "Vidre",
  paper: "Paper i cartró",
  plastic: "Plàstics, mixtos i films",
  bosses: "Bosses de plàstic",
  metallFerric: "Metalls fèrrics",
  metallNoFerric: "Metalls no fèrrics",
  textil: "Tèxtil",
  textilSanitari: "Tèxtil sanitari",
  especials: "Residus especials (perillosos)",
  voluminosos: "Voluminosos",
  altres: "Altres",
  perdues: "Pèrdues",
};

/**
 * Chart groups: eight series max (validated categorical order, never cycled).
 * Small categories are folded into named groups; tables always keep all 11.
 */
export const CHART_GROUPS: { id: string; label: string; keys: ImproperKey[]; slot: number }[] = [
  { id: "plastic", label: "Plàstics, mixtos i films", keys: ["plastic"], slot: 1 },
  { id: "bosses", label: "Bosses de plàstic", keys: ["bosses"], slot: 2 },
  { id: "paper", label: "Paper i cartró", keys: ["paper"], slot: 3 },
  { id: "vidre", label: "Vidre", keys: ["vidre"], slot: 4 },
  { id: "textilSanitari", label: "Tèxtil sanitari", keys: ["textilSanitari"], slot: 5 },
  { id: "metalls", label: "Metalls (fèrrics + no fèrrics)", keys: ["metallFerric", "metallNoFerric"], slot: 6 },
  { id: "textil", label: "Tèxtil", keys: ["textil"], slot: 7 },
  { id: "altres", label: "Altres + especials + voluminosos", keys: ["altres", "especials", "voluminosos"], slot: 8 },
];

export function groupComposition(comp: Partial<Record<CompositionKey, number>> | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of CHART_GROUPS) out[g.id] = comp ? g.keys.reduce((a, k) => a + (comp[k] ?? 0), 0) : 0;
  return out;
}
