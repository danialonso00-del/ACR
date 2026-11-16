import { ExternalLink } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { Badge, Card, CardHeader, Note } from "@/components/ui/primitives";
import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { BarsWithN } from "@/components/charts/charts";
import { ImportWizard } from "@/features/import/import-wizard";
import { IMPORT_FIELDS } from "@/features/import/importer";
import { loadContext, type SearchParams } from "@/lib/context";
import { SOURCE_CATALOG } from "@/lib/data/sources";
import { QUALITY_RULES, DEFAULT_QUALITY } from "@/lib/analytics/formulas";
import { ESTIMATOR_INFO, ANOMALY_Z, MIN_SAMPLES_PER_WINDOW } from "@/lib/analytics/metrics";
import { fmtInstant, fmtNum } from "@/lib/format";

export const metadata = { title: "Fonts i qualitat" };

const STATUS = { verificada: { tone: "brand", label: "Verificada" }, parcial: { tone: "warn", label: "Parcial" }, pendent: { tone: "neutral", label: "Pendent" } } as const;

export default async function SourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const { ds, locale, t } = ctx;
  if (!ds) return <PageFrame ctx={ctx} title={t("sources.title")}>{null}</PageFrame>;
  const meta = ds.meta as typeof ds.meta & { reconciliation?: { checked: number; impropisWithin01pp: number; categoriesWithin002pp: number; categoryChecks: number } };
  const issueCounts = new Map<string, number>();
  for (const r of ds.records) for (const q of r.quality) issueCounts.set(q.code, (issueCounts.get(q.code) ?? 0) + 1);
  const attribution = new Map<string, number>();
  for (const r of ds.records) attribution.set(r.attribution, (attribution.get(r.attribution) ?? 0) + 1);
  const loaded = meta.coverage.filter((c) => c.loaded);

  return (
    <PageFrame ctx={ctx} title={t("sources.title")} description="Catàleg de fonts amb estat de verificació, cobertura temporal efectiva, regles de qualitat versionades, fórmules i importació manual d'extractes autoritzats.">
      <Card>
        <CardHeader title="Catàleg de fonts" subtitle="Estats: Verificada · Parcial · Pendent, amb data de darrera comprovació" />
        <div className="overflow-x-auto px-2 pb-3 pt-2">
          <table className="w-full min-w-[860px] text-[12.5px]">
            <thead className="text-left text-[12px] text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Font</th>
                <th scope="col" className="px-3 py-2 font-medium">Estat</th>
                <th scope="col" className="px-3 py-2 font-medium">Comprovada</th>
                <th scope="col" className="px-3 py-2 font-medium">Evidència</th>
                <th scope="col" className="px-3 py-2 font-medium">Limitacions</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_CATALOG.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="max-w-[260px] px-3 py-2.5">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-start gap-1 font-medium text-brand-dark hover:underline dark:text-[var(--focus)]">
                        {s.name} <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden />
                      </a>
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-2.5">{s.checkedAt.split("-").reverse().join("/")}</td>
                  <td className="px-3 py-2.5 text-muted">{s.evidence}</td>
                  <td className="px-3 py-2.5 text-muted">{s.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ChartCard
          title="Quina cobertura temporal té el conjunt carregat?"
          subtitle={`${t(`mode.${meta.mode}`)} · anys no carregats es mostren buits (no són zeros)`}
          csvName="cobertura-per-any"
          table={{
            columns: [
              { key: "year", label: "Any butlletí" },
              { key: "loaded", label: "Carregat" },
              { key: "samples", label: "Mostres", align: "right" },
              { key: "circuits", label: "Circuits", align: "right" },
              { key: "withSamplingDate", label: "Amb data mostra", align: "right" },
              { key: "withComposition", label: "Amb composició", align: "right" },
              { key: "photosIndexed", label: "Galeries amb fotos", align: "right" },
              { key: "issues", label: "Avisos/errors", align: "right" },
              { key: "sha", label: "SHA-256 captura" },
            ],
            rows: meta.coverage.map(({ unknownHeaders, ...c }) => ({ ...c, unknownHeaders: unknownHeaders.join(", "), loaded: c.loaded ? "sí" : "no", sha: c.captureSha256?.slice(0, 16) ?? null })),
          }}
        >
          <BarsWithN rows={meta.coverage.map((c) => ({ label: String(c.year), value: c.loaded ? c.samples : null, n: c.samples }))} yName="mostres" height={260} />
        </ChartCard>
        <Card>
          <CardHeader title="Snapshot i reconciliació" subtitle={meta.label} />
          <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 px-5 pb-4 pt-3 text-[12.5px]">
            <dt className="text-muted">Identificador</dt>
            <dd className="break-all">{meta.id}</dd>
            <dt className="text-muted">Captura</dt>
            <dd>{fmtInstant(meta.capturedFrom, locale)} – {fmtInstant(meta.capturedTo, locale)}</dd>
            <dt className="text-muted">Construït</dt>
            <dd>{fmtInstant(meta.builtAt, locale)}</dd>
            <dt className="text-muted">Registres</dt>
            <dd>{fmtNum(meta.recordCount, 0, locale)} · anys {loaded.map((c) => c.year).join(", ")}</dd>
            <dt className="text-muted">Parser / regles</dt>
            <dd>{meta.parserVersion} · {meta.qualityRuleVersion}</dd>
            <dt className="text-muted">Atribució territorial</dt>
            <dd>{[...attribution.entries()].map(([k, v]) => `${k}: ${fmtNum(v, 0, locale)}`).join(" · ")}</dd>
            {meta.reconciliation ? (
              <>
                <dt className="text-muted">Reconciliació</dt>
                <dd>
                  % impropis recalculat = informat (±0,1 pp) en {fmtNum(meta.reconciliation.impropisWithin01pp, 0, locale)} / {fmtNum(meta.reconciliation.checked, 0, locale)} mostres; categories (±0,02 pp) {fmtNum(meta.reconciliation.categoriesWithin002pp, 0, locale)} / {fmtNum(meta.reconciliation.categoryChecks, 0, locale)}.
                </dd>
              </>
            ) : null}
          </dl>
          <ul className="list-disc px-9 pb-4 text-[12px] text-muted">{meta.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Regles de qualitat" subtitle={`${meta.qualityRuleVersion} · cap valor es corregeix automàticament`} />
          <div className="px-4 pb-4 pt-2">
            <DataTable
              maxHeight={420}
              spec={{
                columns: [{ key: "code", label: "Codi" }, { key: "sev", label: "Severitat" }, { key: "label", label: "Regla" }, { key: "n", label: "Registres", align: "right" }],
                rows: QUALITY_RULES.map((r) => ({ code: r.code, sev: r.severity, label: r.label, n: issueCounts.get(r.code) ?? 0 })),
              }}
            />
            <p className="mt-2 text-[12px] text-muted">
              Toleràncies configurables: balanç {DEFAULT_QUALITY.balanceToleranceKg} kg o {DEFAULT_QUALITY.balanceTolerancePct} %; recàlcul {DEFAULT_QUALITY.recalcTolerancePp} pp; pèrdues {DEFAULT_QUALITY.highLossesPct} % (llindar de demo). Validació/acceptació (estat del SDR) i representativitat (regla &lt; {DEFAULT_QUALITY.lowMassKg} kg) són dimensions separades.
            </p>
          </div>
        </Card>
        <Card id="metodologia" className="scroll-mt-28">
          <CardHeader title="Metodologia i fórmules" subtitle="Detall a docs/METHODOLOGY.md i docs/DATA_DICTIONARY.md" />
          <div className="prose-arc px-5 pb-5 pt-2 text-[13px]">
            <p>
              <strong>Massa de referència</strong> = pes total pesat + pèrdues (igual que la font; coincideix amb la massa declarada quan el balanç tanca).
            </p>
            <p>
              <strong>pp categoria</strong> = 100 × kg × factor corrector / massa de referència. <strong>% impropis</strong> = Σ categories. FORM = 100 − impropis − pèrdues − FV.
            </p>
            <ul>
              <li><strong>{ESTIMATOR_INFO.mean_sample.label}</strong>: {ESTIMATOR_INFO.mean_sample.formula}.</li>
              <li><strong>{ESTIMATOR_INFO.mass_ratio.label}</strong>: {ESTIMATOR_INFO.mass_ratio.formula}.</li>
              <li><strong>Mitjana ponderada per tones recollides</strong>: no disponible (manca font de tones per circuit).</li>
            </ul>
            <p>
              Diferències de percentatges en <strong>punts percentuals (pp)</strong>; variacions relatives en %. Canvi interanual sobre <strong>cohort estable</strong>; per circuit amb ≥ {MIN_SAMPLES_PER_WINDOW} mostres per període i IC 95 % de Welch. Anomalies: z robust ≥ {ANOMALY_Z}.
            </p>
            <p>
              Malbaratament alimentari: indicadors d&apos;una subestructura de la mostra; mai se sumen a la composició. Nuls, no mesurats i zeros són estats diferents.
            </p>
            <p>
              Factors correctors: el 2006 tots valen 1,00; en anys recents paper (0,66) i bosses (0,54) es corregeixen. Les sèries llargues travessen canvis de metodologia: interpretar-les amb cautela.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Importador manual (CSV / XLSX / JSON)" subtitle="Alternativa robusta quan la font pública no és suficient o per a extractes autoritzats per l'ARC" />
        <div className="px-5 pb-5 pt-3">
          <ImportWizard fields={IMPORT_FIELDS} />
        </div>
      </Card>
      <Note tone="neutral" className="mt-4">
        Connector de backend: peticions serialitzades, interval mínim configurable (SDR_MIN_INTERVAL_MS), timeouts, reintents amb backoff, límit de mida, llista blanca d&apos;hosts i identificació del client. Capa raw immutable amb hash, URL, paràmetres i data de captura. Ingesta idempotent per identificador de butlletí amb historial de revisions.
      </Note>
    </PageFrame>
  );
}
