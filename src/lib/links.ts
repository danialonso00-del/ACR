import { filtersToQuery, type Filters } from "@/lib/analytics/filters";

/** Builds an internal link that keeps the current scope, with explicit overrides. */
export function scopedHref(path: string, filters: Partial<Filters>, overrides: Partial<Filters> = {}, extra: Record<string, string> = {}): string {
  const q = filtersToQuery(filters, overrides);
  const params = new URLSearchParams(q.startsWith("?") ? q.slice(1) : q);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  const s = params.toString();
  return `${path}${s ? `?${s}` : ""}`;
}

export const officialBulletinUrl = (id: string) => `https://sdr.arc.cat/cform/EditCaracteritzacions.do?oid=${encodeURIComponent(id)}&accio=Modificar`;
