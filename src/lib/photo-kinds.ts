import type { PhotoRecord } from "@/lib/data/types";

/** Display labels for photo kinds (shared by server and client components). */
export const KIND_LABEL: Record<PhotoRecord["kind"], string> = {
  lot: "Lot",
  identificacio: "Identificació",
  mostra: "Mostra",
  organica: "Orgànica",
  impropi: "Impropi",
  incidencia: "Incidència / altres",
  desconegut: "Sense tipus",
};
