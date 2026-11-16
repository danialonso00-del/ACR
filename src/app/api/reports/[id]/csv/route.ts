import { jsonError } from "@/lib/api";
import { getReport } from "@/features/reports/store";
import { getDataset } from "@/lib/data/repository";
import { FiltersSchema } from "@/lib/analytics/filters";
import { buildScope } from "@/lib/analytics/scope";
import { exportColumns } from "@/features/explorer/rows";
import { toCsv } from "@/lib/csv";

/** CSV of the samples behind a report (its saved scope) with provenance header lines. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = getReport((await params).id);
  if (!r) return jsonError(404, "Report not found");
  const filters = FiltersSchema.parse(r.filters);
  const ds = getDataset(filters.mode, filters.importId);
  if (!ds) return jsonError(404, "Dataset no longer available");
  const scope = buildScope(ds.records, ds.meta, filters);
  const cols = exportColumns();
  const validIds = new Set(scope.valid.map((x) => x.id));
  const csv = toCsv(
    ["inclosa_analisi", ...cols.map((c) => c.label)],
    scope.inScope.map((rec) => [validIds.has(rec.id) ? "si" : "no", ...cols.map((c) => c.get(rec))]),
    [
      `Informe: ${r.title} (${r.id})`,
      `Pregunta: ${r.question}`,
      `Àmbit: ${r.scopeLabel}`,
      `Dataset de l'informe: ${r.datasetId}; dataset actual: ${ds.meta.id}${r.datasetId !== ds.meta.id ? " (DIFERENT: les xifres poden variar)" : ""}`,
      "Demostració tecnològica MTI — no és un servei oficial de l'ARC",
    ],
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${r.id}-mostres.csv"`, "Cache-Control": "no-store" } });
}
