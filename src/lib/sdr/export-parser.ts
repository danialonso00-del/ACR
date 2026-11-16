/**
 * Parser for the SDR "EXPORTAR" CSV of FORM characterisations (public circuits).
 *
 * Observed format (2026-11-04): windows-1252, ';' separator, no quoting, CRLF,
 * trailing ';' on every line, comma decimals, dd/mm/yyyy dates. Free-text
 * observation fields may contain ';', which shifts columns; those rows are
 * re-aligned from both ends and flagged.
 *
 * Columns are mapped by normalised header label, never by position, so that
 * header changes between years are detected instead of silently misread.
 */

export const PARSER_VERSION = "sdr-export-parser/1.0.0";

/** Canonical keys for the export columns. */
export const HEADER_MAP: Record<string, string> = {
  "num butlleti": "bulletinId",
  lot: "lot",
  "empresa caracteritzadora": "company",
  periode: "bulletinQuarter",
  any: "bulletinYear",
  circuit: "circuitName",
  "ens local titular recollida": "titular",
  "municipi/s": "municipalitiesRaw",
  "tipus recollida": "collectionType",
  "tipus form": "formType",
  "dia recepcio": "receptionDate",
  "hora recepcio": "receptionTime",
  "matricula vehicle": "vehiclePlate", // personal-ish data: parsed but never exposed
  "quantitat descarregada": "dischargedKg",
  "instal·lacio caracteritzacio": "facility",
  "data presa mostres": "samplingDate",
  "hora inici presa mostra": "samplingStart",
  "hora fi presa mostra": "samplingEnd",
  "data caracteritzacio": "characterizationDate",
  "hora inici caracteritzacio": "characterizationStart",
  "hora fi caracteritzacio": "characterizationEnd",
  "nombre treballadors": "workers",
  "pes form caracteritzada": "sampleKg",
  "form: malbaratament alimentari (kg)": "food.formWasteKg",
  "altres residus impropis: malbaratament alimentari (kg)": "food.otherWasteKg",
  "total malbaratament alimentari (kg)": "food.totalWasteKg",
  "form: fv de mida petita assimiable a form (kg)": "food.smallFvKg",
  "form: altres (kg)": "food.formOtherKg",
  "altres residus impropis: altres (kg)": "food.otherImproperKg",
  "form: total (kg)": "food.formTotalKg",
  "altres residus impropis: total (kg)": "food.otherImproperTotalKg",
  "malbaratament alimentari sobre l'organica bruta (%)": "food.wastePct",
  "total residus alimentaris + elements compostables(kg)": "food.foodCompostableKg",
  "residus alimentaris + elements compostables sobre fraccio organica bruta(%)": "food.foodCompostablePct",
  "presencia de fv petita (%)": "food.smallFvPct",
  "presencia de fv (fv petita + poda) (%)": "food.fvPct",
  "pes form": "kg.form",
  "pes poda": "kg.poda",
  "pes form+poda": "kg.formPoda",
  "pes vidre": "kg.vidre",
  "pes paper-cartro": "kg.paper",
  "pes plastic, mixtos i film": "kg.plastic",
  "pes bosses plastic": "kg.bosses",
  "pes metall ferric": "kg.metallFerric",
  "pes metall no ferric": "kg.metallNoFerric",
  "pes textil": "kg.textil",
  "pes textil-sanitari": "kg.textilSanitari",
  "pes residus especials": "kg.especials",
  "pes total voluminosos": "kg.voluminososTotal",
  "pes residus voluminosos": "kg.voluminosos",
  "pes altres": "kg.altres",
  "pes total impropis": "kg.totalImpropis",
  "pes total": "kg.total",
  "pes perdues": "kg.perdues",
  "factor corrector vidre": "factor.vidre",
  "factor corrector paper-cartro": "factor.paper",
  "factor corrector plastic, mixtos i film": "factor.plastic",
  "factor corrector bosses plastic": "factor.bosses",
  "factor corrector metall ferric": "factor.metallFerric",
  "factor corrector metall no ferric": "factor.metallNoFerric",
  "factor corrector textil": "factor.textil",
  "factor corrector textil-sanitari": "factor.textilSanitari",
  "factor corrector residus especials": "factor.especials",
  "factor corrector residus voluminosos": "factor.voluminosos",
  "factor corrector altres": "factor.altres",
  "% form": "pct.form",
  "% fv": "pct.fv",
  "% form+fv": "pct.formFv",
  "% vidre": "pct.vidre",
  "% paper-cartro": "pct.paper",
  "% plastic, mixtos i film": "pct.plastic",
  "% bosses plastic": "pct.bosses",
  "% metall ferric": "pct.metallFerric",
  "% metall no ferric": "pct.metallNoFerric",
  "% textil": "pct.textil",
  "% textil-sanitari": "pct.textilSanitari",
  "% residus especials": "pct.especials",
  "% residus voluminosos": "pct.voluminosos",
  "% residus altres": "pct.altres",
  "% total impureses": "pct.totalImpropis",
  "% total": "pct.total",
  "% perdues": "pct.perdues",
  "observacions caracteritzacio": "obsCharacterization",
  "observacions altres residus": "obsOtherWaste",
  "poda no voluminosa (pes mostra)": "poda.noVoluminosaMostraKg",
  "poda voluminosa (pes mostra)": "poda.voluminosaMostraKg",
  "poda voluminosa (pes lot)": "poda.voluminosaLotKg",
  "residus voluminosos (pes mostra)": "voluminosos.mostraKg",
  "residus voluminosos (pes lot)": "voluminosos.lotKg",
  "assistents a la caracteritzacio": "attendees", // names of people: parsed but never exposed
  "presencia de bosses compostables (%)": "compostableBagsPct",
  "data presentacio": "presentationDate",
};

const OBS_KEYS = ["obsCharacterization", "obsOtherWaste"] as const;

export function normaliseHeader(h: string): string {
  return h
    .replace(/\t/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/l\.l/g, "l·l")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedExport {
  parserVersion: string;
  headers: string[];
  mappedColumns: Record<string, number>;
  unknownHeaders: string[];
  missingKnownHeaders: string[];
  rows: ParsedExportRow[];
}

export interface ParsedExportRow {
  line: number;
  values: Record<string, string>;
  realigned: boolean; // observations contained ';' and the row had to be re-aligned
}

/** Split the CSV into rows; no quoting is used by the source. */
export function parseExportCsv(text: string): ParsedExport {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const rawHeaders = (lines[0] ?? "").split(";");
  // Trailing ';' produces an empty last header.
  while (rawHeaders.length && rawHeaders.at(-1) === "") rawHeaders.pop();
  const headers = rawHeaders.map(normaliseHeader);

  const mappedColumns: Record<string, number> = {};
  const unknownHeaders: string[] = [];
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h];
    if (key) mappedColumns[key] = i;
    else unknownHeaders.push(rawHeaders[i] ?? h);
  });
  const missingKnownHeaders = Object.entries(HEADER_MAP)
    .filter(([, key]) => mappedColumns[key] === undefined)
    .map(([label]) => label);

  const n = headers.length;
  const obsIdx = OBS_KEYS.map((k) => mappedColumns[k]).filter((i): i is number => i !== undefined);
  const firstObs = obsIdx.length ? Math.min(...obsIdx) : -1;
  const lastObs = obsIdx.length ? Math.max(...obsIdx) : -1;

  const rows: ParsedExportRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    let cells = lines[li]!.split(";");
    if (cells.length > n && cells.at(-1) === "") cells = cells.slice(0, -1);
    let realigned = false;
    if (cells.length > n && firstObs >= 0) {
      // Extra separators come from free-text observations: keep the fixed
      // columns on both sides and merge the surplus into the observation span.
      const extra = cells.length - n;
      const before = cells.slice(0, firstObs);
      const after = cells.slice(lastObs + 1 + extra);
      const middle = cells.slice(firstObs, lastObs + 1 + extra);
      const span = lastObs - firstObs + 1;
      const merged: string[] = [];
      if (span === 1) merged.push(middle.join(";"));
      else {
        // Ambiguous split: assign surplus to the first observation field.
        merged.push(middle.slice(0, extra + 1).join(";"), ...middle.slice(extra + 1));
      }
      cells = [...before, ...merged, ...after];
      realigned = true;
    }
    const values: Record<string, string> = {};
    for (const [key, idx] of Object.entries(mappedColumns)) values[key] = (cells[idx] ?? "").trim();
    rows.push({ line: li + 1, values, realigned });
  }
  return { parserVersion: PARSER_VERSION, headers: rawHeaders, mappedColumns, unknownHeaders, missingKnownHeaders, rows };
}

/** "1.234,56" | "250,67" | "" → number | null. Rejects non-numeric text. */
export function parseDecimal(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (s === "") return null;
  const cleaned = s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** "22/12/2025" → "2025-12-22" (local calendar date, Europe/Madrid; no time zone shift). */
export function parseDateDMY(raw: string | undefined): string | null {
  const m = raw?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dd = Number(d), mm = Number(mo), yy = Number(y);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1990 || yy > 2100) return null;
  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
