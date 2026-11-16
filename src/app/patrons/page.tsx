import Link from "next/link";
import { Suspense } from "react";
import { PageFrame } from "@/components/shell/page-frame";
import { Badge, Card, Note } from "@/components/ui/primitives";
import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { BarsWithN, DivergingBars, SampleScatter } from "@/components/charts/charts";
import { FindingCard } from "@/features/patterns/finding-card";
import { InterventionForm } from "@/features/patterns/intervention-form";
import { loadContext, circuitLabel, type SearchParams } from "@/lib/context";
import { anomalies, beforeAfter, changeAnalysis, CLUSTER_METHOD, clusterProfiles, persistentChanges, seasonality, ANOMALY_Z } from "@/lib/analytics/metrics";
import { CATEGORY_LABEL } from "@/lib/categories";
import { fmtDate, fmtNum, fmtPct, fmtPp } from "@/lib/format";
import { scopedHref } from "@/lib/links";

export const metadata = { title: "Patrons i anomalies" };
const MONTHS = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];

export default async function PatternsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const { scope, ds, locale, t } = ctx;
  if (!scope || !ds) return <PageFrame ctx={ctx} title={t("patterns.title")}>{null}</PageFrame>;
  const f = scope.filters;
  const sample = (id: string) => scopedHref(`/caracteritzacions/${id}`, f);

  const change = changeAnalysis(scope.history, f.to, 12);
  const worse = change.circuits.filter((c) => c.diffPp > 0).slice(0, 10);
  const better = change.circuits.filter((c) => c.diffPp < 0).sort((a, b) => a.diffPp - b.diffPp).slice(0, 10);
  const persistent = persistentChanges(scope.history, f.to);
  const anom = anomalies(scope.history, scope.valid);
  const season = seasonality(scope.valid);
  const clusters = clusterProfiles(scope.valid, 4);
  const intervention = f.circuit && typeof ctx.sp.intervention === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ctx.sp.intervention) ? beforeAfter(scope.history, f.circuit, ctx.sp.intervention, Number(ctx.sp.window) || 12) : null;
  const circuitHistory = f.circuit ? scope.history.filter((r) => r.circuitKey === f.circuit) : [];
  const anomIds = new Set(anomalies(circuitHistory, circuitHistory).map((a) => a.id));

  return (
    <PageFrame
      ctx={ctx}
      title={t("patterns.title")}
      description="Cada hallazgo inclou pregunta, període, cohort, n, mètode, magnitud, incertesa, limitacions, taula subjacent i accions per a revisió humana. Els resultats es calculen en temps real sobre l'àmbit seleccionat; no hi ha troballes precalculades."
    >
      <nav aria-label="Seccions" className="no-print mb-4 flex flex-wrap gap-2 text-[13px]">
        {[
          ["#canvi", "Canvi interanual"],
          ["#persistents", "Canvis persistents"],
          ["#anomalies", "Anomalies"],
          ["#estacionalitat", "Estacionalitat"],
          ["#perfils", "Perfils de composició"],
          ["#intervencio", "Abans / després"],
        ].map(([h, l]) => (
          <a key={h} href={h} className="rounded-full border border-line bg-surface px-3 py-1 text-muted hover:text-ink">
            {l}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-4">
        <FindingCard
          id="canvi"
          title="Quins circuits han canviat més en el darrer any?"
          meta={{
            question: "Diferència del % d'impropis entre els darrers 12 mesos i els 12 anteriors, per circuit amb dades comparables.",
            period: `${change.windows.prev[0]}–${change.windows.prev[1]} vs ${change.windows.cur[0]}–${change.windows.cur[1]}`,
            cohort: `${change.circuits.length} circuits amb ≥ ${change.minPerWindow} mostres a cada període; ${change.excludedCircuits} exclosos per manca de mostres. Agregat sobre cohort estable de ${change.cohort.circuits} circuits.`,
            n: `${change.cohort.nPrev} → ${change.cohort.nCur} mostres (cohort)`,
            method: "Mitjana per mostra; diferència de Welch amb IC 95 % aproximat per circuit (robust si no inclou 0).",
            magnitude: (
              <p>
                Cohort estable: <strong>{fmtPct(change.cohort.meanPrev, 2, locale)} → {fmtPct(change.cohort.meanCur, 2, locale)}</strong> ({fmtPp(change.cohort.diffPp, 2, locale)}). Totes les mostres: {fmtPp(change.allSamples.diffPp, 2, locale)}. {change.circuits.filter((c) => c.robust && c.diffPp > 0).length} empitjoraments i {change.circuits.filter((c) => c.robust && c.diffPp < 0).length} millores robustes.
              </p>
            ),
            uncertainty: "Amb 3–5 mostres per circuit i any, els intervals són amplis. No es corregeix per comparacions múltiples.",
            limitations: "Canvis en el calendari de mostreig, l'empresa caracteritzadora o el protocol poden afectar la comparació.",
            actions: "Revisar fotos i observacions dels circuits robustos; confirmar amb l'equip tècnic si hi ha hagut canvis de recollida.",
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[12.5px] font-medium text-muted">Més augment (pp)</p>
              {worse.length ? <DivergingBars rows={worse.map((c) => ({ label: c.circuitName, value: c.diffPp, lo: c.lo, hi: c.hi, n: `n ${c.nPrev}→${c.nCur}${c.robust ? " · robust" : ""}` }))} /> : <p className="text-[13px] text-subtle">Cap.</p>}
            </div>
            <div>
              <p className="mb-1 text-[12.5px] font-medium text-muted">Més disminució (pp)</p>
              {better.length ? <DivergingBars rows={better.map((c) => ({ label: c.circuitName, value: c.diffPp, lo: c.lo, hi: c.hi, n: `n ${c.nPrev}→${c.nCur}${c.robust ? " · robust" : ""}` }))} /> : <p className="text-[13px] text-subtle">Cap.</p>}
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-brand-dark dark:text-[var(--focus)]">Taula subjacent ({change.circuits.length} circuits) i categories</summary>
            <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <DataTable
                maxHeight={320}
                spec={{
                  columns: [{ key: "c", label: "Circuit" }, { key: "np", label: "n abans", align: "right" }, { key: "nc", label: "n ara", align: "right" }, { key: "mp", label: "% abans", align: "right" }, { key: "mc", label: "% ara", align: "right" }, { key: "d", label: "Δ pp", align: "right" }, { key: "ci", label: "IC 95 %", align: "right" }, { key: "cat", label: "Categories que més varien" }],
                  rows: change.circuits.map((c) => ({ c: c.circuitName, np: c.nPrev, nc: c.nCur, mp: c.meanPrev, mc: c.meanCur, d: c.diffPp, ci: `${c.lo} a ${c.hi}`, cat: c.topCategories.map((x) => `${CATEGORY_LABEL[x.key]} ${x.deltaPp > 0 ? "+" : ""}${x.deltaPp}`).join("; ") })),
                }}
              />
              <DataTable maxHeight={320} spec={{ columns: [{ key: "k", label: "Categoria (cohort)" }, { key: "d", label: "Δ pp", align: "right" }], rows: change.categories.map((c) => ({ k: CATEGORY_LABEL[c.key], d: c.deltaPp })) }} />
            </div>
          </details>
        </FindingCard>

        <FindingCard
          id="persistents"
          title={`${persistent.length} circuits amb un canvi persistent`}
          meta={{
            question: "Hi ha circuits on el canvi es manté en mostres successives, i no és un pic aïllat?",
            period: `Fins a ${f.to}`,
            cohort: "Circuits amb ≥ 12 mostres vàlides",
            n: "12 últimes mostres de cada circuit",
            method: "Mediana de les 4 últimes vs mediana de les 8 anteriors; es marca si |desplaçament| ≥ max(1 pp, MAD) i ≥ 3 de les 4 queden fora de mediana ± MAD.",
            magnitude: <p>{persistent.filter((p) => p.shiftPp > 0).length} a l&apos;alça i {persistent.filter((p) => p.shiftPp < 0).length} a la baixa.</p>,
            uncertainty: "Regla heurística transparent, no un test estadístic formal.",
            limitations: "Sensible a canvis de freqüència de mostreig.",
            actions: "Seguiment a les properes campanyes dels circuits a l'alça.",
          }}
        >
          <DataTable
            maxHeight={300}
            spec={{
              columns: [{ key: "c", label: "Circuit" }, { key: "b", label: "Mediana base", align: "right" }, { key: "r", label: "Mediana recent", align: "right" }, { key: "s", label: "Desplaçament (pp)", align: "right" }, { key: "k", label: "Consistència" }, { key: "d", label: "Última mostra" }],
              rows: persistent.map((p) => ({ c: p.circuitName, b: p.baselineMedian, r: p.recentMedian, s: p.shiftPp, k: `${p.consistent}/4`, d: fmtDate(p.lastDate, locale) })),
            }}
          />
        </FindingCard>

        <FindingCard
          id="anomalies"
          title={`${anom.length} mostres atípiques respecte del seu circuit`}
          meta={{
            question: "Quines mostres s'allunyen molt de l'historial comparable del seu circuit?",
            period: `${f.from}–${f.to} (mostres avaluades); historial complet del circuit com a referència`,
            cohort: "Circuits amb ≥ 9 mostres vàlides",
            n: `${scope.valid.length} mostres avaluades`,
            method: `z robust = (x − mediana del circuit) / MAD (mínim 0,5 pp); |z| ≥ ${ANOMALY_Z}.`,
            magnitude: (
              <p>
                {anom.filter((a) => a.kind === "possible_error_dades").length} amb indicis d&apos;error de dades (balanç, massa, dates) i {anom.filter((a) => a.kind === "possible_incidencia_operativa").length} possibles incidències operatives.
              </p>
            ),
            uncertainty: "La classificació és orientativa: depèn de les regles de qualitat activades.",
            limitations: "Una anomalia no és un error; pot ser una campanya real excepcional.",
            actions: "Errors de dades: revisar el registre amb l'empresa caracteritzadora. Incidències: revisar fotos i observacions del butlletí.",
          }}
        >
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="tabular w-full min-w-[680px] text-[12.5px]">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Butlletí</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Circuit</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Data</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">%</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Mediana circuit</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">z</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Classificació</th>
                </tr>
              </thead>
              <tbody>
                {anom.slice(0, 40).map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-3 py-1.5"><Link className="font-medium text-brand-dark hover:underline dark:text-[var(--focus)]" href={sample(a.id)}>{a.id}</Link></td>
                    <td className="max-w-[220px] truncate px-3 py-1.5">{a.circuitName}</td>
                    <td className="px-3 py-1.5">{fmtDate(a.date, locale)}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmtNum(a.value, 2, locale)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(a.baselineMedian, 2, locale)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(a.z, 1, locale)}</td>
                    <td className="px-3 py-1.5" title={a.reasons.join("\n")}>
                      {a.kind === "possible_error_dades" ? <Badge tone="danger">possible error de dades</Badge> : <Badge tone="info">possible incidència operativa</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {anom.length > 40 ? <p className="mt-2 text-[12px] text-muted">Es mostren les 40 amb |z| més alt de {anom.length}.</p> : null}
        </FindingCard>

        <FindingCard
          id="estacionalitat"
          title={season.eligible ? `Estacionalitat: amplitud mensual de ${fmtPp(season.amplitudePp, 1, locale)}` : "Estacionalitat: dades insuficients"}
          meta={{
            question: `Varien els impropis segons el mes de presa de mostra${f.circuit ? ` al circuit ${circuitLabel(ctx, f.circuit)}` : ""}?`,
            period: `${f.from}–${f.to}`,
            cohort: f.circuit ? "Un circuit" : "Totes les mostres vàlides de l'àmbit (barreja de circuits)",
            n: `${scope.valid.length} mostres`,
            method: "Mitjana mensual i test de Kruskal–Wallis entre mesos amb ≥ 5 mostres.",
            magnitude: season.eligible && season.kruskal ? <p>H = {fmtNum(season.kruskal.H, 1, locale)}, gl = {season.kruskal.df}, p {season.kruskal.p < 0.001 ? "< 0,001" : `= ${fmtNum(season.kruskal.p, 3, locale)}`}.</p> : <p>{season.reason}</p>,
            uncertainty: "Amb molts registres, diferències petites poden ser estadísticament significatives sense rellevància pràctica.",
            limitations: "La mescla de circuits pot variar per mes (efecte de composició). Per a una lectura neta, filtra un circuit.",
            actions: "Tenir en compte el mes en comparar campanyes i en planificar el mostreig.",
          }}
        >
          <ChartCard title="Mitjana del % d'impropis per mes" subtitle="n per mes al tooltip i a la taula" csvName="estacionalitat" table={{ columns: [{ key: "m", label: "Mes" }, { key: "n", label: "n", align: "right" }, { key: "v", label: "% mitjà", align: "right" }, { key: "md", label: "Mediana", align: "right" }], rows: season.byMonth.map((m) => ({ m: MONTHS[m.month - 1], n: m.n, v: m.mean, md: m.median })) }}>
            <BarsWithN rows={season.byMonth.map((m) => ({ label: MONTHS[m.month - 1]!, value: m.mean, n: m.n }))} />
          </ChartCard>
        </FindingCard>

        <FindingCard
          id="perfils"
          title="Perfils de composició (agrupació exploratòria)"
          meta={{
            question: "Hi ha grups de mostres amb una composició d'impropis semblant?",
            period: `${f.from}–${f.to}`,
            cohort: "Mostres vàlides de l'àmbit",
            n: clusters ? `${clusters.n} mostres` : "insuficient",
            method: CLUSTER_METHOD,
            magnitude: clusters ? <p>{clusters.k} perfils; mides {clusters.clusters.map((c) => c.size).join(", ")}.</p> : <p>Cal un mínim de 40 mostres.</p>,
            uncertainty: "k fix i inicialització determinista; altres k o transformacions poden donar grups diferents.",
            limitations: "Exploratori: els grups descriuen semblances, no tipologies ni causes.",
            actions: "Usar-ho per orientar revisions, no per classificar circuits oficialment.",
          }}
        >
          {clusters ? (
            <div className="grid gap-3 md:grid-cols-2">
              {clusters.clusters.map((c) => (
                <div key={c.id} className="rounded-lg border border-line p-3 text-[12.5px]">
                  <p className="font-semibold">
                    Perfil {c.id} · {c.size} mostres · impropis ≈ {fmtNum(100 - c.profile.form - c.profile.fv - c.profile.perdues, 1, locale)} %
                  </p>
                  <p className="mt-1 text-muted">
                    Més present que la mitjana: {c.distinctive.map((d) => `${CATEGORY_LABEL[d.key]} (×${fmtNum(d.ratio, 1, locale)})`).join(", ")}
                  </p>
                  <p className="mt-1 text-subtle">Circuits freqüents: {c.topCircuits.map((x) => `${x.name} (${x.n})`).join(", ")}</p>
                </div>
              ))}
            </div>
          ) : null}
        </FindingCard>

        <FindingCard
          id="intervencio"
          title="Abans i després d'una intervenció documentada"
          meta={{
            question: "Canvien els impropis d'un circuit després d'una data concreta (campanya, canvi de sistema…)?",
            period: intervention ? `${intervention.months} mesos abans i després de ${fmtDate(intervention.date, locale)}` : "—",
            cohort: f.circuit ? circuitLabel(ctx, f.circuit) : "Cal seleccionar un circuit",
            n: intervention ? `${intervention.nPre} abans · ${intervention.nPost} després` : "—",
            method: "Diferència de mitjanes (Welch) amb IC 95 % aproximat; requereix ≥ 3 mostres per finestra.",
            magnitude: intervention ? (intervention.enough ? <p>{fmtPct(intervention.meanPre, 2, locale)} → {fmtPct(intervention.meanPost, 2, locale)} ({fmtPp(intervention.diffPp, 2, locale)}; IC {intervention.lo} a {intervention.hi}).</p> : <p>Mostres insuficients a alguna de les finestres.</p>) : <p>Introdueix una data documentada.</p>,
            uncertainty: "Pocs punts per finestra; interval ampli.",
            limitations: intervention?.caveat ?? "Associació temporal; no demostra causalitat.",
            actions: "Documentar la intervenció (data, abast) i repetir l'anàlisi amb més campanyes.",
          }}
        >
          <Suspense fallback={null}>
            <InterventionForm hasCircuit={Boolean(f.circuit)} />
          </Suspense>
          {f.circuit && circuitHistory.length ? (
            <div className="mt-4">
              <SampleScatter points={circuitHistory.map((r) => ({ id: r.id, date: r.dates.sampling!, value: r.derived.impropisPct!, flagged: anomIds.has(r.id) }))} />
            </div>
          ) : null}
          {ctx.filters.mode === "synthetic_demo" ? <Note tone="warn" className="mt-3">Dades sintètiques: «CIRCUIT FICTICI 07» té una intervenció fictícia l&apos;abril de 2023 per provar aquesta anàlisi.</Note> : null}
        </FindingCard>
        <Card className="p-4 text-[12.5px] text-muted">
          Previsió (forecast): no s&apos;ofereix en aquesta fase. Només s&apos;activarà si supera un baseline estacional en avaluació temporal fora de mostra.
        </Card>
      </div>
    </PageFrame>
  );
}
