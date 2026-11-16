import Link from "next/link";
import { Suspense } from "react";
import { PageFrame } from "@/components/shell/page-frame";
import { Card, CardHeader, Note } from "@/components/ui/primitives";
import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { BoxplotChart, CompositionChart } from "@/components/charts/charts";
import { Choropleth } from "@/components/charts/choropleth";
import { ComparePicker } from "@/features/territory/compare-picker";
import { loadContext, type SearchParams } from "@/lib/context";
import { commonPeriod, composition, distribution, ESTIMATOR_INFO, groupBy, groupInto, bucketsBetween } from "@/lib/analytics/metrics";
import { groupComposition } from "@/lib/categories";
import { getGeo } from "@/lib/geo/comarques";
import { fmtNum } from "@/lib/format";
import { scopedHref } from "@/lib/links";
import type { Characterization } from "@/lib/data/types";

export const metadata = { title: "Territori" };

export default async function TerritoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const { scope, ds, locale, t } = ctx;
  if (!scope || !ds) return <PageFrame ctx={ctx} title={t("territory.title")}>{null}</PageFrame>;
  const f = scope.filters;
  const geo = getGeo(f.mode);
  const byComarca = groupBy(scope.valid, (r) => r.comarcaCode, (k) => ctx.comarques.get(k) ?? k, f.estimator, f.minN).sort((a, b) => a.label.localeCompare(b.label, "ca"));
  const mapValues = Object.fromEntries(byComarca.map((g) => [g.key, { value: g.value, n: g.n, circuits: g.circuits, sufficient: g.sufficient }]));
  const supra = ds.circuits.filter((c) => c.attribution === "supracomarcal");
  const unresolved = scope.valid.filter((r) => r.attribution === "unresolved").length;

  // ---- comparison (URL: cmpType, cmp, stable)
  const cmpType = ctx.sp.cmpType === "comarca" ? "comarca" : "circuit";
  const keys = (typeof ctx.sp.cmp === "string" ? ctx.sp.cmp.split("~") : []).filter(Boolean).slice(0, 4);
  const stable = ctx.sp.stable === "1";
  // Comparison ignores the global circuit/comarca filter (it selects its own entities) but keeps period and other filters.
  const base = scope.history.filter((r) => r.dates.sampling! >= `${f.from}-01` && r.dates.sampling!.slice(0, 7) <= f.to);
  let groups: Characterization[][] = keys.map((k) => base.filter((r) => (cmpType === "circuit" ? r.circuitKey === k : r.comarcaCode === k)));
  const period = keys.length >= 2 ? commonPeriod(groups) : null;
  let stableNote: string | null = null;
  if (period) {
    groups = groups.map((g) => g.filter((r) => r.dates.sampling!.slice(0, 7) >= period[0] && r.dates.sampling!.slice(0, 7) <= period[1]));
    if (stable) {
      // Keep circuits with samples in every year of the common period.
      const years = bucketsBetween(period[0], period[1], "year");
      const filtered = groups.map((g) => {
        const byC = groupInto(g, (r) => r.circuitKey);
        const keep = new Set([...byC.entries()].filter(([, rs]) => years.every((y) => rs.some((r) => r.dates.sampling!.startsWith(y)))).map(([k]) => k));
        return { rows: g.filter((r) => keep.has(r.circuitKey)), dropped: byC.size - keep.size };
      });
      groups = filtered.map((x) => x.rows);
      const dropped = filtered.reduce((a, x) => a + x.dropped, 0);
      stableNote = `Cohort estable: només circuits amb mostres a cada any del període comú (${years.join(", ")}); ${dropped} circuits exclosos.`;
    }
  }
  const labelFor = (k: string) => (cmpType === "circuit" ? (ds.circuits.find((c) => c.key === k)?.label ?? k) : (ctx.comarques.get(k) ?? k));
  const quarters = period ? bucketsBetween(period[0], period[1], "quarter") : [];
  const cmpRows = keys.map((k, i) => {
    const g = groups[i] ?? [];
    const d = distribution(g);
    const covered = new Set(g.map((r) => `${r.dates.sampling!.slice(0, 4)}-T${Math.ceil(Number(r.dates.sampling!.slice(5, 7)) / 3)}`)).size;
    return { key: k, label: labelFor(k), d, circuits: new Set(g.map((r) => r.circuitKey)).size, coverage: quarters.length ? `${covered}/${quarters.length} trimestres` : "—", comp: groupComposition(composition(g, f.estimator)), n: g.length };
  });

  return (
    <PageFrame ctx={ctx} title={t("territory.title")} description="Valors per comarca a partir dels municipis declarats a cada butlletí. Un circuit que serveix municipis de diverses comarques no es reparteix ni es duplica: es mostra com a circuit supracomarcal. La instal·lació de caracterització no s'utilitza com a origen del residu.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Quines comarques tenen més impropis a l'àmbit?" subtitle={`${ESTIMATOR_INFO[f.estimator].label} · fonts: ${geo.source}`} />
          <div className="px-4 pb-4 pt-2">
            <Choropleth shapes={geo.shapes} viewBox={geo.viewBox} values={mapValues} selected={f.comarca} minN={f.minN} fictitious={geo.kind === "fictitious"} height={560} />
            <p className="mt-2 text-[11.5px] text-subtle">
              No pintades: {fmtNum(scope.valid.filter((r) => r.attribution === "supracomarcal").length, 0, locale)} mostres de circuits supracomarcals i {fmtNum(unresolved, 0, locale)} amb municipi no resolt. Llindar de n configurable a la barra de filtres.
            </p>
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Taula per comarca" subtitle="Alternativa accessible al mapa" />
          <div className="px-4 pb-4 pt-2">
            <DataTable
              maxHeight={620}
              caption="Valors per comarca"
              spec={{
                columns: [
                  { key: "label", label: "Comarca" },
                  { key: "n", label: "n", align: "right" },
                  { key: "circuits", label: "Circuits", align: "right" },
                  { key: "value", label: "% impropis", align: "right" },
                  { key: "median", label: "Mediana", align: "right" },
                  { key: "status", label: "Estat" },
                ],
                rows: [...ctx.comarques.entries()]
                  .sort((a, b) => a[1].localeCompare(b[1], "ca"))
                  .map(([code, name]) => {
                    const g = byComarca.find((x) => x.key === code);
                    return { label: name, n: g?.n ?? 0, circuits: g?.circuits ?? 0, value: g?.sufficient ? fmtNum(g.value, 2, locale) : null, median: g?.sufficient ? fmtNum(g.median, 2, locale) : null, status: !g ? "sense dades" : g.sufficient ? "ok" : `n < ${f.minN}` };
                  }),
              }}
            />
          </div>
        </Card>
      </div>

      <section id="comparacio" className="mt-4 flex flex-col gap-4">
        <Card>
          <CardHeader title="Comparació de 2–4 circuits o comarques" subtitle="Període comú, distribució, categories, n i cobertura. Els filtres globals de període i tipus s'apliquen; la selecció d'entitats és pròpia d'aquesta secció." />
          <div className="px-5 pb-5 pt-3">
            <Suspense fallback={<div className="skeleton h-10" />}>
              <ComparePicker
                circuits={ds.circuits.map((c) => ({ value: c.key, label: c.label, hint: `${c.n} mostres · ${c.first?.slice(0, 4) ?? "?"}–${c.last?.slice(0, 4) ?? "?"}` }))}
                comarques={[...ctx.comarques.entries()].map(([code, name]) => ({ value: code, label: name }))}
              />
            </Suspense>
            {keys.length < 2 ? <p className="mt-3 text-[13px] text-muted">Selecciona almenys dues entitats per comparar.</p> : null}
            {keys.length >= 2 && !period ? <Note tone="warn" className="mt-3">Les entitats seleccionades no tenen cap període comú amb mostres vàlides dins el període filtrat.</Note> : null}
            {period ? (
              <p className="mt-3 text-[13px]">
                Període comú: <strong>{period[0]} – {period[1]}</strong>. {stableNote}
              </p>
            ) : null}
          </div>
        </Card>
        {period ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Com es distribueix el % d'impropis a cada entitat?"
              subtitle="Caixes: P25–P75 i mediana; bigotis: mínim i màxim"
              csvName="comparacio-distribucio"
              table={{
                columns: [{ key: "label", label: "Entitat" }, { key: "n", label: "n", align: "right" }, { key: "circuits", label: "Circuits", align: "right" }, { key: "mean", label: "Mitjana", align: "right" }, { key: "median", label: "Mediana", align: "right" }, { key: "q1", label: "P25", align: "right" }, { key: "q3", label: "P75", align: "right" }, { key: "coverage", label: "Cobertura" }],
                rows: cmpRows.map((r) => ({ label: r.label, n: r.n, circuits: r.circuits, mean: r.d?.mean ?? null, median: r.d?.median ?? null, q1: r.d?.q1 ?? null, q3: r.d?.q3 ?? null, coverage: r.coverage })),
              }}
              footer={
                <span>
                  {cmpRows.map((r) => `${r.label}: n = ${r.n}, ${r.coverage}`).join(" · ")}. Amb n petites les diferències poden no ser concloents.
                </span>
              }
            >
              <BoxplotChart rows={cmpRows.filter((r) => r.d).map((r) => ({ label: r.label, ...r.d! }))} />
            </ChartCard>
            <ChartCard title="Quines categories hi pesen més?" subtitle="pp sobre la massa de referència, període comú" csvName="comparacio-composicio">
              <CompositionChart horizontal rows={cmpRows.map((r) => ({ bucket: r.label, n: r.n, groups: r.comp }))} height={Math.max(220, cmpRows.length * 64 + 90)} />
            </ChartCard>
          </div>
        ) : null}
      </section>

      <Card className="mt-4">
        <CardHeader title="Circuits supracomarcals" subtitle={`${supra.length} circuits serveixen municipis de més d'una comarca; no es reparteixen sense una ponderació acreditada`} />
        <div className="px-4 pb-4 pt-2">
          <DataTable
            maxHeight={300}
            spec={{
              columns: [{ key: "label", label: "Circuit" }, { key: "munis", label: "Municipis" }, { key: "n", label: "Mostres", align: "right" }],
              rows: supra.map((c) => ({ label: c.label, munis: c.municipalities.join(", "), n: c.n })),
            }}
          />
          <p className="mt-2 text-[12px] text-muted">
            Població, turisme o sistema de recollida no es mostren: encara no s&apos;han incorporat fonts fiables per a aquests atributs. <Link href={scopedHref("/fonts", f)} className="underline">Fonts</Link>
          </p>
        </div>
      </Card>
    </PageFrame>
  );
}
