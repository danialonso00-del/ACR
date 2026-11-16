import { Suspense } from "react";
import { FilterBar, type FilterBarProps } from "./filter-bar";
import { JourneySteps } from "./journey";
import { AssistantLauncher } from "@/features/assistant/launcher";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { defaultPeriod } from "@/lib/analytics/scope";
import { scopeDescription, type PageContext } from "@/lib/context";
import { fmtInstant, fmtNum } from "@/lib/format";
import { existsSync } from "node:fs";
import path from "node:path";

function filterBarProps(ctx: PageContext): FilterBarProps | null {
  const { t, filters } = ctx;
  const ds = ctx.ds;
  if (!ds) return null;
  const months: string[] = [];
  for (const y of [...ds.meta.yearsLoaded].sort()) for (let m = 1; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, "0")}`);
  const def = defaultPeriod(ds.meta, ds.records);
  const lastIdx = months.indexOf(def.to);
  const usable = lastIdx >= 0 ? months.slice(0, lastIdx + 1) : months;
  const records = ds.records;
  const distinct = (fn: (r: (typeof records)[number]) => string | null) => [...new Set(records.map(fn).filter((x): x is string => !!x))].sort();
  const synthetic = filters.mode === "synthetic_demo";
  const values: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(filters)) values[k] = v === undefined ? undefined : String(v);
  for (const k of ["from", "to", "comarca", "circuit", "formType", "collectionType", "importId"]) values[k] = typeof ctx.sp[k] === "string" ? (ctx.sp[k] as string) : undefined;
  values.estimator = typeof ctx.sp.estimator === "string" ? ctx.sp.estimator : undefined;
  values.lowMass = typeof ctx.sp.lowMass === "string" ? ctx.sp.lowMass : undefined;
  values.minN = typeof ctx.sp.minN === "string" ? ctx.sp.minN : undefined;
  values.mode = filters.mode;
  values.from = values.from ?? def.from;
  values.to = values.to ?? def.to;
  const comarcaCounts = new Map<string, number>();
  for (const c of ds.circuits) if (c.comarcaCode) comarcaCounts.set(c.comarcaCode, (comarcaCounts.get(c.comarcaCode) ?? 0) + 1);
  return {
    values,
    months: usable,
    defaults: def,
    comarques: [...ctx.comarques.entries()].map(([code, name]) => ({ value: code, label: name, hint: `${comarcaCounts.get(code) ?? 0} circuits atribuïts` })).sort((a, b) => a.label.localeCompare(b.label, "ca")),
    circuits: ds.circuits.map((c) => ({ value: c.key, label: c.label, hint: `${c.municipalities.slice(0, 3).join(", ")}${c.municipalities.length > 3 ? "…" : ""} · ${c.n} mostres`, comarca: c.comarcaCode })),
    formTypes: distinct((r) => r.formType),
    collectionTypes: distinct((r) => r.collectionType),
    modes: [
      { value: "public_snapshot", label: t("mode.public_snapshot") },
      { value: "imported", label: `${t("mode.imported")}${ctx.imports.length ? ` (${ctx.imports.length})` : " · cap importació"}`, disabled: ctx.imports.length === 0 },
      { value: "synthetic_demo", label: t("mode.synthetic_demo"), disabled: !existsSync(path.join(process.cwd(), "data", "snapshots", "synthetic_demo", "meta.json")) },
    ],
    imports: ctx.imports.map((i) => ({ value: i.id, label: `${i.label} (${i.recordCount})` })),
    status: {
      label: t(`mode.${filters.mode}`),
      tone: synthetic ? "synthetic" : filters.mode === "imported" ? "info" : "brand",
      detail: synthetic
        ? "territoris i circuits fictius"
        : `${t("status.snapshot")} ${fmtInstant(ds.meta.capturedTo, ctx.locale)} · ${fmtNum(ds.meta.recordCount, 0, ctx.locale)} registres`,
    },
    labels: {
      title: t("filters.title"),
      period: t("filters.period"),
      from: t("filters.from"),
      to: t("filters.to"),
      territory: t("filters.territory"),
      allTerritory: t("filters.allTerritory"),
      circuit: t("filters.circuit"),
      allCircuits: t("filters.allCircuits"),
      stream: t("filters.stream"),
      streamUnavailable: t("filters.streamUnavailable"),
      mode: t("filters.mode"),
      estimator: t("filters.estimator"),
      est_mean_sample: t("est.mean_sample"),
      est_mass_ratio: t("est.mass_ratio"),
      lowMass: t("filters.lowMass"),
      exclude: t("filters.exclude"),
      include: t("filters.include"),
      minN: t("filters.minN"),
      reset: t("filters.reset"),
      more: t("filters.more"),
      formType: t("filters.formType"),
      collectionType: t("filters.collectionType"),
      any: t("filters.any"),
      applying: t("filters.applying"),
      allLoaded: "Tot",
    },
  };
}

export function PageFrame({ ctx, title, description, actions, children, hideFilters = false, hideAssistant = false }: { ctx: PageContext; title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; hideFilters?: boolean; hideAssistant?: boolean }) {
  const fb = hideFilters ? null : filterBarProps(ctx);
  const synthetic = ctx.filters.mode === "synthetic_demo";
  const t = ctx.t;
  const journey = { label: t("journey.label"), overview: t("journey.overview"), territory: t("journey.territory"), sample: t("journey.sample"), photos: t("journey.photos"), ai: t("journey.ai"), report: t("journey.report") };
  return (
    <>
      {fb ? (
        <Suspense fallback={<div className="h-[104px]" />}>
          <FilterBar {...fb} />
        </Suspense>
      ) : null}
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Suspense fallback={null}>
          <JourneySteps labels={journey} />
        </Suspense>
        <header className="rise mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {synthetic ? <Badge tone="synthetic">Dades sintètiques · no reals</Badge> : null}
              {ctx.scope ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-[12px] font-medium text-muted ring-1 ring-line">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-g-500" />
                  <span className="truncate">{scopeDescription(ctx)}</span>
                </span>
              ) : null}
            </div>
            <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[34px]">{title}</h1>
            {description ? <div className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-muted">{description}</div> : null}
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            {actions}
            {fb && !hideAssistant ? <AssistantLauncher query={ctx.query} aiConfigured={ctx.aiConfigured} scopeLabel={scopeDescription(ctx)} /> : null}
          </div>
        </header>
        {ctx.ds ? (
          <div className="stagger">{children}</div>
        ) : (
          <EmptyState title="No hi ha cap conjunt de dades per a aquest mode">
            {ctx.filters.mode === "imported"
              ? "Encara no s'ha importat cap fitxer. Utilitza l'importador a Fonts i qualitat."
              : "Executa npm run data:all per generar els conjunts locals."}
          </EmptyState>
        )}
      </main>
    </>
  );
}
