import "server-only";
import { cache } from "react";
import { parseFilters, filtersToQuery, type Filters } from "@/lib/analytics/filters";
import { buildScope, type Scope } from "@/lib/analytics/scope";
import { getDataset, listImports, type LoadedDataset } from "@/lib/data/repository";
import { comarcaNames } from "@/lib/geo/comarques";
import { getT } from "@/i18n/server";
import type { Locale, MessageKey } from "@/i18n/messages";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface PageContext {
  sp: SearchParams;
  filters: Filters;
  query: string;
  ds: LoadedDataset | null;
  scope: Scope | null;
  comarques: Map<string, string>;
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  aiConfigured: boolean;
  imports: ReturnType<typeof listImports>;
}

export const loadContext = cache(async (spPromise: Promise<SearchParams>): Promise<PageContext> => {
  const sp = await spPromise;
  const filters = parseFilters(sp);
  const { t, locale } = await getT();
  const ds = getDataset(filters.mode, filters.importId);
  const scope = ds ? buildScope(ds.records, ds.meta, filters) : null;
  return {
    sp,
    filters,
    query: filtersToQuery(filters),
    ds,
    scope,
    comarques: comarcaNames(filters.mode),
    locale,
    t,
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    imports: listImports(),
  };
});

export function circuitLabel(ctx: PageContext, key: string): string {
  return ctx.ds?.circuits.find((c) => c.key === key)?.label ?? key.split("|")[0] ?? key;
}

export function scopeDescription(ctx: PageContext): string {
  if (!ctx.scope) return "";
  const f = ctx.scope.filters;
  const parts = [`${f.from} → ${f.to}`];
  parts.push(f.comarca ? (ctx.comarques.get(f.comarca) ?? f.comarca) : "Tota Catalunya");
  if (f.circuit) parts.push(circuitLabel(ctx, f.circuit));
  parts.push(f.stream);
  return parts.join(" · ");
}
