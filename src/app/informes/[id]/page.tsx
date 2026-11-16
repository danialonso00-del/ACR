import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { Badge, Card, CardHeader, Note, linkButtonClass } from "@/components/ui/primitives";
import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { BarsWithN } from "@/components/charts/charts";
import { ReportToolbar, SummaryEditor } from "@/features/reports/report-toolbar";
import { getReport } from "@/features/reports/store";
import { loadContext, type SearchParams } from "@/lib/context";
import { fmtInstant } from "@/lib/format";
import { filtersToQuery, FiltersSchema } from "@/lib/analytics/filters";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const ctx = await loadContext(searchParams);
  const r = getReport(id);
  if (!r) notFound();
  const reportQuery = filtersToQuery(FiltersSchema.parse(r.filters));
  const stale = ctx.ds && r.datasetId !== "—" && FiltersSchema.parse(r.filters).mode === ctx.filters.mode && ctx.ds.meta.id !== r.datasetId;

  return (
    <PageFrame
      ctx={ctx}
      hideFilters
      title={r.title}
      description={
        <span className="flex flex-col gap-1">
          <span>Pregunta: {r.question}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            {r.mode === "synthetic_demo" ? <Badge tone="synthetic">Dades sintètiques</Badge> : <Badge tone="brand">{ctx.t(`mode.${r.mode as "public_snapshot"}`)}</Badge>}
            <Badge>{r.datasetId}</Badge>
            <span className="text-subtle">Creat {fmtInstant(r.createdAt, ctx.locale)} · {r.author}</span>
          </span>
        </span>
      }
      actions={
        <>
          <Link href="/informes" className={linkButtonClass("ghost", "sm")}>
            <ArrowLeft size={15} aria-hidden /> Informes
          </Link>
          <ReportToolbar id={r.id} />
        </>
      }
    >
      <Note tone="info" className="mb-4">
        Aquest informe conserva el seu propi abast: <strong>{r.scopeLabel}</strong>. Pot diferir dels filtres actuals de l&apos;aplicació.{" "}
        <Link href={`/${reportQuery}`} className="font-medium underline underline-offset-2">Obrir aquest abast a la visió general</Link>
        {stale ? <span className="mt-1 block font-medium text-warn">El conjunt de dades ha canviat des de la creació ({r.datasetId} → {ctx.ds?.meta.id}): torna a executar la investigació per actualitzar les xifres.</span> : null}
      </Note>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Resum executiu" />
            <div className="px-5 pb-5 pt-2">
              <SummaryEditor id={r.id} initial={r.summary} />
              {r.results ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {r.results.kpis.map((k) => (
                    <div key={k.label} className="rounded-lg border border-line px-3 py-2">
                      <dt className="text-[12px] text-muted">{k.label}</dt>
                      <dd className="tabular text-[18px] font-semibold">{k.value}</dd>
                      <dd className="text-[11.5px] text-subtle">{k.detail}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </Card>
          {r.results?.series.length ? (
            <ChartCard
              title="Com ha evolucionat el % d'impropis per any?"
              subtitle="Valors de l'abast desat; anys sense mostres buits"
              csvName={`${r.id}-serie`}
              table={{ columns: [{ key: "bucket", label: "Any" }, { key: "value", label: "% impropis", align: "right" }, { key: "n", label: "n", align: "right" }], rows: r.results.series.map((s) => ({ ...s })) }}
            >
              <BarsWithN rows={r.results.series.map((s) => ({ label: s.bucket, value: s.value, n: s.n }))} />
            </ChartCard>
          ) : null}
          {r.findings.length ? (
            <Card>
              <CardHeader title="Troballes" subtitle="Cada troballa inclou pregunta, període, cohort, n, mètode, magnitud, incertesa, limitacions i accions per a revisió humana" />
              <ol className="flex flex-col gap-4 px-5 pb-5 pt-3">
                {r.findings.map((f, i) => (
                  <li key={i} className="rounded-xl border border-line p-4">
                    <h3 className="text-[14.5px] font-semibold">
                      {i + 1}. {f.title}
                    </h3>
                    <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-[150px_1fr]">
                      {(
                        [
                          ["Pregunta", f.question],
                          ["Període", f.period],
                          ["Cohort", f.cohort],
                          ["Mida de mostra", f.n],
                          ["Mètode", f.method],
                          ["Magnitud", f.magnitude],
                          ["Incertesa", f.uncertainty],
                          ["Limitacions", f.limitations],
                          ["Accions suggerides", f.actions],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted">{k}</dt>
                          <dd className="text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {f.table ? <div className="mt-3"><DataTable spec={{ columns: f.table.columns.map((c, j) => ({ key: String(j), label: c, align: j ? "right" : "left" })), rows: f.table.rows.map((row) => Object.fromEntries(row.map((v, j) => [String(j), v]))) }} maxHeight={260} /></div> : null}
                    {f.sampleIds.length ? (
                      <p className="mt-2 text-[12px] text-muted">
                        Butlletins ({f.sampleIds.length}):{" "}
                        {f.sampleIds.slice(0, 12).map((sid, j) => (
                          <span key={sid}>
                            {j ? ", " : ""}
                            <Link className="text-brand-dark hover:underline dark:text-[var(--focus)]" href={`/caracteritzacions/${sid}${reportQuery}`}>{sid}</Link>
                          </span>
                        ))}
                        {f.sampleIds.length > 12 ? ` … (+${f.sampleIds.length - 12})` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
          {r.items.length ? (
            <Card>
              <CardHeader title="Elements afegits" subtitle="Des de l'assistent, fitxes de mostra o anàlisis" />
              <ul className="flex flex-col gap-3 px-5 pb-5 pt-3">
                {r.items.map((it) => (
                  <li key={it.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{it.kind}</Badge>
                      <h3 className="text-[14px] font-semibold">{it.title}</h3>
                      <span className="text-[11.5px] text-subtle">{fmtInstant(it.addedAt, ctx.locale)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{it.text}</p>
                    {it.evidence?.length ? (
                      <ul className="mt-2 flex flex-col gap-1 text-[12px] text-muted">
                        {it.evidence.map((e, j) => (
                          <li key={j}>
                            <span className="font-medium text-ink">{e.tool}</span> · {e.summary} {e.n !== undefined ? `· n = ${e.n}` : ""} {e.dataset ? `· ${e.dataset}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {it.table ? <div className="mt-2"><DataTable spec={{ columns: it.table.columns.map((c, j) => ({ key: String(j), label: c })), rows: it.table.rows.map((row) => Object.fromEntries(row.map((v, j) => [String(j), v]))) }} maxHeight={240} /></div> : null}
                    {it.sampleIds?.length ? <p className="mt-2 text-[12px] text-muted">Butlletins: {it.sampleIds.slice(0, 15).join(", ")}{it.sampleIds.length > 15 ? "…" : ""}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          {r.results?.composition.length ? (
            <Card>
              <CardHeader title="Composició" subtitle="pp sobre la massa de referència" />
              <div className="px-4 pb-4 pt-2">
                <DataTable spec={{ columns: [{ key: "label", label: "Categoria" }, { key: "pp", label: "pp", align: "right" }], rows: r.results.composition.map((c) => ({ label: c.label, pp: c.pp.toFixed(3) })) }} maxHeight={420} />
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Hipòtesis" subtitle="No verificades: requereixen contrast" />
            <ul className="list-disc px-9 pb-4 pt-2 text-[13px] leading-relaxed">{r.hypotheses.map((h) => <li key={h}>{h}</li>)}</ul>
          </Card>
          <Card>
            <CardHeader title="Limitacions" />
            <ul className="list-disc px-9 pb-4 pt-2 text-[13px] leading-relaxed">{r.limitations.map((h) => <li key={h}>{h}</li>)}</ul>
          </Card>
          <Card>
            <CardHeader title="Propers passos" />
            <ul className="list-disc px-9 pb-4 pt-2 text-[13px] leading-relaxed">{r.nextSteps.map((h) => <li key={h}>{h}</li>)}</ul>
          </Card>
          <Card>
            <CardHeader title="Pla, fonts i consultes" subtitle="Traçabilitat del dossier (sense raonament privat del model)" />
            <div className="flex flex-col gap-3 px-5 pb-5 pt-2 text-[12.5px]">
              <p>{r.plan.scope || "—"}</p>
              <ul className="list-disc pl-5">{r.plan.sources.map((s) => <li key={s.name}>{s.name} · {s.status}{s.url ? <> · <a className="underline" href={s.url} target="_blank" rel="noreferrer noopener">enllaç</a></> : null}</li>)}</ul>
              {r.results?.exclusions.length ? <p className="text-muted">Exclusions: {r.results.exclusions.map((e) => `${e.label} (${e.count})`).join("; ")}</p> : null}
              <ol className="list-decimal pl-5 text-muted">{r.queries.map((q, i) => <li key={i}><span className="font-medium text-ink">{q.tool}</span> {JSON.stringify(q.input).slice(0, 120)}</li>)}</ol>
            </div>
          </Card>
        </div>
      </div>
    </PageFrame>
  );
}
