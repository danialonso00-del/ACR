/**
 * Explicit, resumable ingestion job for the public SDR FORM characterisations.
 *
 *   npm run ingest:sdr -- --years 2006,2019-2026 [--refresh] [--max-years 12]
 *
 * For each bulletin year it captures (1) the official EXPORTAR CSV and (2) the
 * public list with "mostrar tots" (adds state and acceptance date). Years that
 * already have a capture are skipped unless --refresh is given, so an
 * interrupted run resumes where it stopped. Requests are serialised and spaced
 * (SDR_MIN_INTERVAL_MS, default 2 s). Only read operations are used.
 */
import { sdrRequest, SdrError } from "../../src/lib/sdr/http";
import { latestCapture, storeRaw } from "./raw-store";

const LIST_PATH = "/cform/ListCaracteritzacions.do";

function parseYears(spec: string): number[] {
  const years = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-").map((s) => Number(s.trim()));
    if (!a) continue;
    for (let y = a; y <= (b ?? a); y++) years.add(y);
  }
  return [...years].sort();
}

function baseForm(year: number): Record<string, string> {
  // Field names observed in the live HTML form on 2026-11-04 (see docs/DATA_SOURCES.md).
  return {
    posInicial: "1",
    adscritServeiPublic: "S",
    ordre: "1",
    offset_default: "12",
    offset: "12",
    butlletiAny: String(year),
    butlletiPeriode: "",
    codiComarca: "00",
  };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const years = parseYears(get("--years") ?? "2026");
  const refresh = args.includes("--refresh");
  const maxYears = Number(get("--max-years") ?? 12);
  if (years.length > maxYears) {
    throw new Error(`Refusing to ingest ${years.length} years in one run (limit ${maxYears}). Use --max-years explicitly.`);
  }

  // Warm-up GET establishes the session cookie used by the legacy form.
  await sdrRequest(LIST_PATH, { method: "GET", maxBytes: 5_000_000 });

  for (const year of years) {
    const key = String(year);
    for (const kind of ["export_csv", "list_html"] as const) {
      if (!refresh && latestCapture(kind, key)) {
        console.log(`[skip] ${kind} ${year} already captured (use --refresh to recapture)`);
        continue;
      }
      const form = kind === "list_html" ? { ...baseForm(year), mostrarTots: "on" } : baseForm(year);
      const pathWithQuery = kind === "export_csv" ? `${LIST_PATH}?accio=Exportar` : LIST_PATH;
      try {
        const res = await sdrRequest(pathWithQuery, { form, timeoutMs: 120_000 });
        const isCsv = (res.contentType ?? "").includes("csv");
        if (kind === "export_csv" && !isCsv) {
          console.warn(`[warn] ${year}: export returned ${res.contentType}; stored for inspection, not parsed as CSV`);
        }
        const entry = storeRaw(
          {
            kind,
            key,
            url: res.url,
            method: "POST",
            params: form,
            capturedAt: res.fetchedAt,
            contentType: res.contentType,
            contentDisposition: res.contentDisposition,
            status: res.status,
          },
          res.body,
          kind === "export_csv" ? (isCsv ? "csv" : "bin") : "html",
        );
        console.log(`[ok] ${kind} ${year}: ${entry.bytes} bytes sha256=${entry.sha256.slice(0, 12)}`);
      } catch (err) {
        const e = err as SdrError;
        console.error(`[error] ${kind} ${year}: ${e.kind ?? "unknown"} ${e.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
