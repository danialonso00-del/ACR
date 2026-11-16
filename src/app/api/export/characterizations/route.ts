import { scopeFromRequest, jsonError } from "@/lib/api";
import { CATEGORY_HEADER_NOTE, exportColumns, queryRows } from "@/features/explorer/rows";
import { toCsv } from "@/lib/csv";
import { ESTIMATOR_INFO } from "@/lib/analytics/metrics";

const MAX_ROWS = 20_000;

/** Filtered export with scope, method and provenance in the header lines. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = scopeFromRequest(url);
  if (!ctx) return jsonError(404, "Dataset not available for this mode");
  const ids = queryRows(ctx.scope, ctx.ds, ctx.comarques, {
    q: url.searchParams.get("q") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    dir: url.searchParams.get("dir") === "asc" ? "asc" : "desc",
    onlyValid: url.searchParams.get("valid") === "1",
  }).map((r) => r.id);
  if (ids.length > MAX_ROWS) return jsonError(413, `Export limited to ${MAX_ROWS} rows; narrow the filters.`);
  const cols = exportColumns();
  const f = ctx.scope.filters;
  const csv = toCsv(
    cols.map((c) => c.label),
    ids.map((id) => {
      const r = ctx.ds.byId.get(id)!;
      return cols.map((c) => c.get(r));
    }),
    [
      "ARC · Intel·ligència de Residus — Demostració tecnològica MTI (no és un servei oficial)",
      `Dataset: ${ctx.ds.meta.id} (${ctx.ds.meta.mode}); parser ${ctx.ds.meta.parserVersion}; regles ${ctx.ds.meta.qualityRuleVersion}`,
      `Àmbit: període ${f.from}..${f.to} (data de presa de mostra); comarca=${f.comarca ?? "totes"}; circuit=${f.circuit ?? "tots"}; flux=${f.stream}; mostres<90kg=${f.lowMass}`,
      `Fórmula: pp_categoria = 100 × kg × factor / (pes total + pèrdues); estimador seleccionat: ${ESTIMATOR_INFO[f.estimator].label}`,
      CATEGORY_HEADER_NOTE,
      `Files: ${ids.length}; exportat ${new Date().toISOString()}`,
    ],
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="caracteritzacions-${f.from}-${f.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
