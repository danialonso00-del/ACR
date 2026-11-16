import Link from "next/link";
import { ArrowRight, CircleAlert, TriangleAlert } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { KpiTile } from "@/components/ui/kpi";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { ChartCard } from "@/components/charts/chart-card";
import { CompositionChart, CountChart, TrendChart } from "@/components/charts/charts";
import { Choropleth } from "@/components/charts/choropleth";
import { loadContext, type SearchParams } from "@/lib/context";
import { aggregateImpropis, changeAnalysis, composition, ESTIMATOR_INFO, groupBy, timeSeries, type Granularity } from "@/lib/analytics/metrics";
import { CATEGORY_LABEL, CHART_GROUPS, groupComposition } from "@/lib/categories";
import { getGeo } from "@/lib/geo/comarques";
import { fmtDate, fmtInstant, fmtNum, fmtPct, fmtPp } from "@/lib/format";
import { scopedHref } from "@/lib/links";
import { addMonths } from "@/lib/analytics/filters";

export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const { t, scope, ds, locale } = ctx;
  if (!scope || !ds) return <PageFrame ctx={ctx} title={t("overview.title")}>{null}</PageFrame>;
  const f = scope.filters;
  const est = f.estimator;

  const agg = aggregateImpropis(scope.valid, est);
  const months = (Number(f.to.slice(0, 4)) - Number(f.from.slice(0, 4))) * 12 + Number(f.to.slice(5)) - Number(f.from.slice(5)) + 1;
  const gran: Granularity = months <= 36 ? "quarter" : "year";
  const series = timeSeries(scope.valid, f.from, f.to, gran, est);
  const change = changeAnalysis(scope.history, f.to, 12);
  const compByYear = timeSeries(scope.valid, f.from, f.to, "year", est).map((p) => {
    const rs = scope.valid.filter((r) => r.dates.sampling!.startsWith(p.bucket));
    return { bucket: p.bucket, n: rs.length, groups: groupComposition(composition(rs, est)) };
  });
  const compAll = composition(scope.valid, est);
  const inScopeIds = new Set(scope.inScope.map((r) => r.id));
  const withPhotos = [...ds.photoChecks.entries()].filter(([id, c]) => inScopeIds.has(id) && c.photos > 0).length;
  const checked = [...ds.photoChecks.keys()].filter((id) => inScopeIds.has(id)).length;

  const byComarca = groupBy(scope.valid, (r) => r.comarcaCode, (k) => ctx.comarques.get(k) ?? k, est, f.minN);
  const mapValues = Object.fromEntries(byComarca.map((g) => [g.key, { value: g.value, n: g.n, circuits: g.circuits, sufficient: g.sufficient }]));
  const geo = getGeo(f.mode);
  const unattributed = scope.valid.filter((r) => !r.comarcaCode).length;

  const recent = [...scope.inScope].sort((a, b) => (b.dates.sampling ?? "").localeCompare(a.dates.sampling ?? "")).slice(0, 8);
  const issueCount = (sev: string) => scope.inScope.filter((r) => r.quality.some((q) => q.severity === sev)).length;
  const lastSampling = recent[0]?.dates.sampling ?? null;
  const worse = change.circuits.filter((c) => c.robust && c.diffPp > 0).slice(0, 3);
  const better = change.circuits.filter((c) => c.robust && c.diffPp < 0).sort((a, b) => a.diffPp - b.diffPp).slice(0, 2);
  const drivers = change.categories.slice(0, 3);
  const explorer = scopedHref("/caracteritzacions", f);
  const estInfo = ESTIMATOR_INFO[est];
  const synthetic = f.mode === "synthetic_demo";

  return (
    <PageFrame
      ctx={ctx}
      title={t("overview.title")}
      description={
        <>
          Caracteritzacions de la fracció orgànica (FORM) de circuits de servei públic.{" "}
          {synthetic ? "Dades sintètiques per provar l'eina." : `Font: consulta pública del SDR de l'ARC, capturada el ${fmtInstant(ds.meta.capturedTo, locale)}.`} Última mostra en l&apos;àmbit:{" "}
          {fmtDate(lastSampling, locale)}.
        </>
      }
    >
      <section aria-label="Indicadors clau" className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label={t("overview.kpi.samples")}
          value={fmtNum(scope.valid.length, 0, locale)}
          denominator={`de ${fmtNum(scope.inScope.length, 0, locale)} mostres a l'àmbit · ${fmtNum(scope.inScope.length - scope.valid.length, 0, locale)} excloses`}
          methodology={
            <>
              <p>Mostres amb data de presa dins del període, composició calculable i sense incidències bloquejants.</p>
              <ul>
                {scope.exclusions.map((e) => (
                  <li key={e.code}>
                    {e.label}: <strong>{e.count}</strong>
                  </li>
                ))}
              </ul>
              <p>Les mostres &lt; 90 kg s&apos;{f.lowMass === "exclude" ? "exclouen" : "inclouen"} (filtre configurable).</p>
            </>
          }
        />
        <KpiTile
          label={t("overview.kpi.circuits")}
          value={fmtNum(agg.circuits, 0, locale)}
          denominator={`de ${fmtNum(ds.circuits.length, 0, locale)} circuits al conjunt carregat`}
          methodology={<p>Un circuit s&apos;identifica pel nom exacte i l&apos;ens titular informats al SDR. No s&apos;uneixen circuits amb noms semblants sense resoldre&apos;n la identitat.</p>}
        />
        <KpiTile
          label={t("overview.kpi.impropis")}
          value={agg.value === null ? "—" : fmtNum(agg.value, 1, locale)}
          unit="%"
          denominator={`${estInfo.label} · n = ${fmtNum(agg.n, 0, locale)}`}
          methodology={
            <>
              <p>
                <strong>{estInfo.label}.</strong> {estInfo.formula}.
              </p>
              <p>
                Denominador per mostra: pes total pesat + pèrdues (igual que la font; reprodueix el «% Total Impureses» del SDR en 15.063 de 15.063 mostres). Inclou factors correctors de la font (p. ex. paper 0,66, bosses 0,54).
              </p>
              <p>Indicador exploratori: no és un indicador oficial ajustat ni una mitjana ponderada per tones recollides (no es disposa de tones per circuit).</p>
            </>
          }
        />
        <KpiTile
          label={t("overview.kpi.change")}
          value={change.cohort.diffPp === null ? "—" : fmtPp(change.cohort.diffPp, 1, locale).replace(" pp", "")}
          unit={change.cohort.diffPp === null ? undefined : "pp"}
          delta={
            change.cohort.diffPp === null
              ? undefined
              : {
                  text: change.cohort.diffPp > 0.05 ? "més impropis" : change.cohort.diffPp < -0.05 ? "menys impropis" : "sense canvi apreciable",
                  tone: change.cohort.diffPp > 0.05 ? "up" : change.cohort.diffPp < -0.05 ? "down" : "flat",
                  note: `${fmtPct(change.cohort.meanPrev, 1, locale)} → ${fmtPct(change.cohort.meanCur, 1, locale)}`,
                }
          }
          denominator={`Cohort estable: ${change.cohort.circuits} circuits · ${change.windows.cur[0]}–${change.windows.cur[1]} vs 12 m anteriors`}
          methodology={
            <>
              <p>
                Diferència de mitjanes per mostra (punts percentuals) entre els darrers 12 mesos fins a {f.to} i els 12 anteriors, només amb circuits presents als dos períodes (cohort estable), per evitar que el canvi de composició de la mostra sembli una millora o un empitjorament.
              </p>
              <p>
                Totes les mostres (sense cohort): {fmtPp(change.allSamples.diffPp, 2, locale)} (n {change.allSamples.nPrev} → {change.allSamples.nCur}).
              </p>
            </>
          }
        />
        <KpiTile
          label={t("overview.kpi.photos")}
          value={fmtNum(withPhotos, 0, locale)}
          unit={`/ ${fmtNum(scope.inScope.length, 0, locale)}`}
          denominator={`mostres amb galeria indexada · ${checked} galeries comprovades a l'àmbit`}
          methodology={
            <p>
              Les galeries del SDR s&apos;indexen amb un job limitat (no descàrrega massiva). Una mostra sense galeria indexada no vol dir que no tingui fotos: vol dir que encara no s&apos;ha comprovat. Drets de reutilització pendents de confirmar.
            </p>
          }
          className="col-span-2 md:col-span-1"
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <ChartCard
          title="Com evoluciona el percentatge d'impropis?"
          subtitle={`${estInfo.label} per ${gran === "quarter" ? "trimestre" : "any"} de presa de mostra · banda P25–P75 · els períodes sense mostres queden buits`}
          csvName="evolucio-impropis"
          methodology={
            <>
              <p>{estInfo.formula}.</p>
              <p>Els buits indiquen períodes sense mostres carregades (p. ex. 2007–2018 no s&apos;han ingerit en aquest extracte); no s&apos;interpolen.</p>
              <p>Clic en un punt per obrir les mostres d&apos;aquell període a l&apos;explorador.</p>
            </>
          }
          table={{
            columns: [
              { key: "bucket", label: "Període" },
              { key: "value", label: "% impropis", align: "right" },
              { key: "p25", label: "P25", align: "right" },
              { key: "p75", label: "P75", align: "right" },
              { key: "n", label: "n mostres", align: "right" },
              { key: "circuits", label: "circuits", align: "right" },
            ],
            rows: series.map((p) => ({ ...p })),
            meta: [`Estimador: ${estInfo.label}`, `Dataset: ${ds.meta.id}`],
          }}
        >
          <TrendChart points={series} label={`% impropis (${estInfo.label.toLowerCase()})`} explorerBase={explorer} />
          <CountChart points={series} />
        </ChartCard>

        <Card className="flex flex-col">
          <CardHeader title={t("overview.changed")} subtitle={`Darrers 12 mesos (${change.windows.cur[0]} – ${change.windows.cur[1]}) vs 12 anteriors`} />
          <div className="flex flex-1 flex-col gap-3 px-5 pb-4 pt-3 text-[13px]">
            {change.cohort.diffPp !== null ? (
              <p className="leading-relaxed text-ink">
                A la cohort estable de <strong>{change.cohort.circuits} circuits</strong>, els impropis passen de <strong>{fmtPct(change.cohort.meanPrev, 1, locale)}</strong> a{" "}
                <strong>{fmtPct(change.cohort.meanCur, 1, locale)}</strong> ({fmtPp(change.cohort.diffPp, 2, locale)}; n {change.cohort.nPrev} → {change.cohort.nCur}).
              </p>
            ) : (
              <p className="text-muted">No hi ha prou dades als dos períodes per comparar.</p>
            )}
            {drivers.length && change.cohort.diffPp !== null ? (
              <div>
                <p className="mb-1 text-[12px] font-medium text-muted">Categories que més varien (pp, cohort)</p>
                <ul className="flex flex-col gap-1">
                  {drivers.map((d) => (
                    <li key={d.key} className="flex items-center justify-between gap-2">
                      <span>{CATEGORY_LABEL[d.key]}</span>
                      <span className={`tabular font-medium ${d.deltaPp > 0 ? "text-danger" : "text-info"}`}>{fmtPp(d.deltaPp, 2, locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="mb-1 text-[12px] font-medium text-muted">Circuits amb canvi robust (IC 95 % aprox. sense 0; ≥ {change.minPerWindow} mostres per període)</p>
              {worse.length + better.length === 0 ? <p className="text-subtle">Cap circuit amb canvi robust en aquest àmbit.</p> : null}
              <ul className="flex flex-col gap-1.5">
                {[...worse, ...better].map((c) => (
                  <li key={c.circuitKey}>
                    <Link href={scopedHref("/patrons", f, { circuit: c.circuitKey })} className="group flex items-center justify-between gap-2 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-surface-2">
                      <span className="min-w-0 truncate">
                        {c.circuitName}
                        <span className="ml-1 text-[11.5px] text-subtle">n {c.nPrev}→{c.nCur}</span>
                      </span>
                      <span className={`tabular shrink-0 font-medium ${c.diffPp > 0 ? "text-danger" : "text-info"}`}>
                        {c.diffPp > 0 ? "▲" : "▼"} {fmtPp(c.diffPp, 1, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Link href={scopedHref("/patrons", f)} className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-brand-dark hover:underline dark:text-[var(--focus)]">
              Veure l&apos;anàlisi completa amb mètode i limitacions <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader
            title="On són més alts els impropis?"
            subtitle={`${estInfo.label} per comarca · només mostres amb atribució comarcal acreditada · n ≥ ${f.minN}`}
            actions={<Link href={scopedHref("/territori", f)} className="text-[13px] font-medium text-brand-dark hover:underline dark:text-[var(--focus)]">Territori →</Link>}
          />
          <div className="px-4 pb-4 pt-2">
            <Choropleth shapes={geo.shapes} viewBox={geo.viewBox} values={mapValues} selected={f.comarca} minN={f.minN} fictitious={geo.kind === "fictitious"} height={380} />
            <p className="mt-2 text-[11.5px] text-subtle">
              {fmtNum(unattributed, 0, locale)} mostres de circuits supracomarcals o amb municipi no resolt no es pinten (no es reparteixen entre comarques). Límits: {geo.source}.
            </p>
          </div>
        </Card>
        <ChartCard
          title="Quins materials componen els impropis?"
          subtitle={`Punts percentuals sobre la massa de referència, per any · ${estInfo.label.toLowerCase()} · ${CHART_GROUPS.length} grups`}
          csvName="composicio-impropis"
          methodology={
            <>
              <p>Cada categoria es calcula sobre la mateixa massa de referència de la mostra (pes total + pèrdues), de manera que les parts són excloents i sumen el total d&apos;impropis.</p>
              <p>Metalls fèrrics i no fèrrics, i «altres + especials + voluminosos», s&apos;agrupen al gràfic per mantenir 8 sèries llegibles; la taula conserva les 11 categories.</p>
              <p>Els indicadors de malbaratament alimentari es mesuren sobre una subestructura de la mostra i no se sumen aquí.</p>
            </>
          }
          table={{
            columns: [{ key: "cat", label: "Categoria" }, { key: "pp", label: "pp (període complet)", align: "right" }],
            rows: compAll
              ? (["form", "fv", "plastic", "bosses", "paper", "vidre", "textilSanitari", "textil", "metallFerric", "metallNoFerric", "especials", "voluminosos", "altres", "perdues"] as const).map((k) => ({ cat: CATEGORY_LABEL[k], pp: compAll[k].toFixed(3) }))
              : [],
          }}
        >
          <CompositionChart rows={compByYear} height={380} />
        </ChartCard>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="min-w-0">
          <CardHeader title={t("overview.recent")} subtitle="Per data de presa de mostra" actions={<Link href={explorer} className="text-[13px] font-medium text-brand-dark hover:underline dark:text-[var(--focus)]">{t("common.viewAll")} →</Link>} />
          <div className="overflow-x-auto px-2 pb-3 pt-2">
            <table className="tabular w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Butlletí</th>
                  <th scope="col" className="px-3 py-2 font-medium">Circuit</th>
                  <th scope="col" className="px-3 py-2 font-medium">Presa de mostra</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Mostra (kg)</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">% impropis</th>
                  <th scope="col" className="px-3 py-2 font-medium">Qualitat</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const warn = r.quality.filter((q) => q.severity !== "info").length;
                  return (
                    <tr key={r.id} className="border-t border-line hover:bg-surface-2/60">
                      <td className="px-3 py-2">
                        <Link className="font-medium text-brand-dark hover:underline dark:text-[var(--focus)]" href={scopedHref(`/caracteritzacions/${r.id}`, f)}>
                          {r.id}
                        </Link>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2">{r.circuitName}</td>
                      <td className="px-3 py-2">{fmtDate(r.dates.sampling, locale)}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(r.derived.referenceKg, 1, locale)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtNum(r.derived.impropisPct, 2, locale)}</td>
                      <td className="px-3 py-2">{warn ? <Badge tone="warn"><TriangleAlert size={11} aria-hidden /> {warn}</Badge> : <Badge>OK</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("overview.quality")} subtitle={`Regles ${ds.meta.qualityRuleVersion}`} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-4 pt-3 text-[13px]">
            <div>
              <dt className="text-muted">Període carregat</dt>
              <dd className="font-medium">{ds.meta.yearsLoaded.length ? `${ds.meta.yearsLoaded[0]}, ${ds.meta.yearsLoaded.slice(1).length ? `${ds.meta.yearsLoaded[1]}–${ds.meta.yearsLoaded.at(-1)}` : ""}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">n a l&apos;àmbit</dt>
              <dd className="tabular font-medium">{fmtNum(scope.inScope.length, 0, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted">Excloses</dt>
              <dd className="tabular font-medium">{fmtNum(scope.inScope.length - scope.valid.length, 0, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted">Avisos / errors</dt>
              <dd className="tabular font-medium">
                {issueCount("warning")} / {issueCount("error")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Camps absents</dt>
              <dd className="font-medium">Motiu d&apos;aturada, tones per circuit</dd>
            </div>
            <div>
              <dt className="text-muted">Retard d&apos;actualització</dt>
              <dd className="font-medium">{lastSampling ? `${Math.max(0, Math.round((Date.parse(ds.meta.capturedTo ?? "") - Date.parse(lastSampling)) / 86400000))} dies` : "—"}</dd>
            </div>
          </dl>
          <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-muted">
            <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Cobertura efectiva: {ds.meta.yearsLoaded.join(", ")}. Anys no carregats: es poden afegir amb el job d&apos;ingestió (<code>npm run ingest:sdr</code>).{" "}
              <Link href={scopedHref("/fonts", f)} className="font-medium text-brand-dark underline-offset-2 hover:underline dark:text-[var(--focus)]">
                Detall
              </Link>
            </span>
          </div>
        </Card>
      </section>
      <p className="mt-6 text-[11.5px] text-subtle">
        Període analitzat {f.from} – {f.to} (data de presa de mostra, Europe/Madrid). La data de captura de la font és diferent de la data de mostreig. Primer mes del període de comparació anterior: {addMonths(change.windows.prev[0], 0)}.
      </p>
    </PageFrame>
  );
}
