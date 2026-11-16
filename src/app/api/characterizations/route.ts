import { scopeFromRequest, jsonError } from "@/lib/api";
import { queryRows } from "@/features/explorer/rows";

/** Server-side pagination, search and sorting for the explorer. Read-only. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ctx = scopeFromRequest(url);
  if (!ctx) return jsonError(404, "Dataset not available for this mode");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const size = Math.min(100, Math.max(5, Number(url.searchParams.get("size") ?? 25) || 25));
  const rows = queryRows(ctx.scope, ctx.ds, ctx.comarques, {
    q: url.searchParams.get("q") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    dir: url.searchParams.get("dir") === "asc" ? "asc" : "desc",
    onlyValid: url.searchParams.get("valid") === "1",
  });
  return Response.json({
    total: rows.length,
    page,
    size,
    rows: rows.slice((page - 1) * size, page * size),
    dataset: ctx.ds.meta.id,
    period: { from: ctx.scope.filters.from, to: ctx.scope.filters.to },
  });
}
