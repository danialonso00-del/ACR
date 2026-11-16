/**
 * Minimal parsers for the public SDR HTML pages (list with "mostrar tots" and
 * the photo gallery). They only read visible, public markup and are
 * deliberately tolerant: anything unrecognised is skipped and counted.
 */
import type { PhotoRecord } from "@/lib/data/types";

const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface ListRow {
  id: string;
  circuit: string;
  titular: string;
  company: string;
  facility: string;
  quarter: string;
  year: string;
  status: string;
  acceptanceDate: string | null; // ISO
  characterizationDate: string | null; // ISO
}

const dmyToIso = (s: string) => {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export function parseListHtml(html: string): { rows: ListRow[]; skipped: number } {
  const rows: ListRow[] = [];
  let skipped = 0;
  for (const tr of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const body = tr[1]!;
    const id = body.match(/gotoedit\((\d+)\)/)?.[1];
    if (!id) continue;
    const tds = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]!));
    if (tds.length !== 9) {
      skipped++;
      continue;
    }
    rows.push({
      id,
      circuit: tds[0]!,
      titular: tds[1]!,
      company: tds[2]!,
      facility: tds[3]!,
      quarter: tds[4]!,
      year: tds[5]!,
      status: tds[6]!,
      acceptanceDate: dmyToIso(tds[7]!),
      characterizationDate: dmyToIso(tds[8]!),
    });
  }
  return { rows, skipped };
}

/** Maps the SDR photo-type label ("8. Vidre", "4.1 Malbaratament…") to an analysis kind. */
export function photoKind(label: string | null): PhotoRecord["kind"] {
  const n = label?.match(/^(\d+)/)?.[1];
  if (!n) return "desconegut";
  const v = Number(n);
  if (v === 1) return "lot";
  if (v === 2) return "identificacio";
  if (v === 3) return "mostra";
  if (v >= 4 && v <= 7) return "organica";
  if (v >= 8 && v <= 19) return "impropi";
  return "incidencia";
}

export const PHOTO_RIGHTS =
  "Imatge pública del SDR (ARC). Condicions de reutilització, publicació i entrenament no confirmades: ús només de consulta.";

export function parseGalleryHtml(html: string, bulletinId: string, capturedAt: string): PhotoRecord[] {
  const photos: PhotoRecord[] = [];
  // Each thumbnail block is followed by its (disabled) type <select>.
  const blocks = html.split(/GetImatge\.do\?imatgeId=/).slice(1);
  let order = 0;
  for (const block of blocks) {
    const idMatch = block.match(/^(\d+)&(?:amp;)?thumbNail=true/);
    if (!idMatch) continue; // modal/full-size occurrences
    const imageId = idMatch[1]!;
    const select = block.match(/<select[^>]*selecImatgeType\d+[^>]*>([\s\S]*?)<\/select>/)?.[1] ?? "";
    const selected = select.match(/<option[^>]*value="([^"]*)"[^>]*selected="selected"[^>]*>([^<]*)/);
    const typeLabel = selected ? strip(selected[2]!) || null : null;
    order++;
    photos.push({
      bulletinId,
      imageId,
      order,
      typeCode: selected?.[1] ?? null,
      typeLabel,
      kind: photoKind(typeLabel),
      thumbUrl: `https://sdr.arc.cat/cform/GetImatge.do?imatgeId=${imageId}&thumbNail=true`,
      fullUrl: `https://sdr.arc.cat/cform/GetImatge.do?thumbNail=false&imatgeId=${imageId}`,
      capturedAt,
      rights: PHOTO_RIGHTS,
    });
  }
  return photos;
}
