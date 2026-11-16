import "server-only";
import { parseFilters } from "@/lib/analytics/filters";
import { buildScope } from "@/lib/analytics/scope";
import { getDataset } from "@/lib/data/repository";
import { comarcaNames } from "@/lib/geo/comarques";

/** Resolves dataset + scope for an API request from its query string (same contract as pages). */
export function scopeFromRequest(url: URL) {
  const filters = parseFilters(url.searchParams);
  const ds = getDataset(filters.mode, filters.importId);
  if (!ds) return null;
  return { filters, ds, scope: buildScope(ds.records, ds.meta, filters), comarques: comarcaNames(filters.mode) };
}

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
