import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, ExternalLink } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { Badge, Card, CardHeader, Note, linkButtonClass } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/overlays";
import { ChartCard } from "@/components/charts/chart-card";
import { SampleScatter } from "@/components/charts/charts";
import { BulletinGallery } from "@/features/archive/photo-gallery";
import { AddToReportButton } from "@/features/reports/add-to-report";
import { loadContext, type SearchParams } from "@/lib/context";
import { CATEGORY_LABEL } from "@/lib/categories";
import { anomalies } from "@/lib/analytics/metrics";
import { isAnalyzable } from "@/lib/data/normalize";
import { IMPROPER_KEYS } from "@/lib/data/types";
import { filtersToQuery } from "@/lib/analytics/filters";
import { fmtDate, fmtInstant, fmtNum } from "@/lib/format";
import { officialBulletinUrl, scopedHref } from "@/lib/links";

export default async function SamplePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const ctx = await loadContext(searchParams);
  const { ds, locale, filters } = ctx;
  const r = ds?.byId.get(id);
  if (!ds || !r) notFound();

  const ref = r.derived.referenceKg;
  const modeQuery = filtersToQuery({ mode: filters.mode, importId: filters.importId });
  const history = ds.records.filter((x) => x.circuitKey === r.circuitKey && x.dates.sampling && isAnalyzable(x, true));
  const flagged = new Set(anomalies(history, history).map((a) => a.id));
  const analyzable = isAnalyzable(r, filters.lowMass === "exclude");
  const isPublic = r.mode === "public_snapshot";
  const balance = r.totalWeighedKg !== null && r.sampleKg !== null ? r.totalWeighedKg + (r.lossesKg ?? 0) - r.sampleKg : null;

  const compRows = [
    ...IMPROPER_KEYS.map((k) => {
      const f = r.improper[k];
      const corrected = f.kg === null ? null : f.kg * (f.factor ?? 1);
      const pp = r.derived.composition?.[k] ?? null;
      return { key: k, label: CATEGORY_LABEL[k], kg: f.kg, factor: f.factor, corrected, pp, reported: f.pctReported, diff: pp !== null && f.pctReported !== null ? pp - f.pctReported : null };
    }),
  ];

  const tabs = [
    {
      value: "composicio",
      label: "Composició",
      content: (
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <Note tone="neutral">
            <p className="font-medium">Fórmula visible</p>
            <p className="tabular mt-1">
              massa de referència = pes total ({fmtNum(r.totalWeighedKg, 2, locale)} kg) + pèrdues ({fmtNum(r.lossesKg, 2, locale)} kg) = <strong>{fmtNum(ref, 2, locale)} kg</strong>
              {r.sampleKg !== null ? <> · massa declarada {fmtNum(r.sampleKg, 2, locale)} kg{balance !== null && Math.abs(balance) > 0.005 ? ` (diferència ${fmtNum(balance, 2, locale)} kg)` : " (balanç tancat)"}</> : null}
            </p>
            <p className="tabular">pp categoria = 100 × kg × factor corrector / massa de referència · impropis = Σ categories = <strong>{fmtNum(r.derived.impropisPct, 2, locale)} %</strong> (informat: {fmtNum(r.pctReported.impropis, 2, locale)} %)</p>
            <p className="mt-1 text-muted">Els valors originals no es corregeixen: les diferències es marquen a «Qualitat».</p>
          </Note>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="tabular w-full min-w-[720px] text-[13px]">
              <caption className="sr-only">Pesades originals i percentatges calculats per categoria</caption>
              <thead className="bg-surface-2 text-[12px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Categoria</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">kg (original)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Factor</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">kg corregits</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">pp calculat</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">% informat</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Diferència</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line bg-surface-2/40">
                  <td className="px-3 py-1.5 font-medium">FORM (resta per diferència)</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.formKg, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right text-subtle">—</td>
                  <td className="px-3 py-1.5 text-right text-subtle">—</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.derived.composition?.form ?? null, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.pctReported.form, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right text-subtle">—</td>
                </tr>
                <tr className="border-t border-line bg-surface-2/40">
                  <td className="px-3 py-1.5">Fracció vegetal (poda)</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.fvKg, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right text-subtle">—</td>
                  <td className="px-3 py-1.5 text-right text-subtle">—</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.derived.composition?.fv ?? null, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.pctReported.fv, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right text-subtle">—</td>
                </tr>
                {compRows.map((c) => (
                  <tr key={c.key} className="border-t border-line">
                    <td className="px-3 py-1.5">{c.label}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(c.kg, 2, locale)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(c.factor, 2, locale)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(c.corrected, 2, locale)}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmtNum(c.pp, 2, locale)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNum(c.reported, 2, locale)}</td>
                    <td className={`px-3 py-1.5 text-right ${c.diff !== null && Math.abs(c.diff) > 0.02 ? "font-medium text-warn" : "text-subtle"}`}>{c.diff === null ? "—" : fmtNum(c.diff, 2, locale)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line">
                  <td className="px-3 py-1.5">Pèrdues</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.lossesKg, 2, locale)}</td>
                  <td colSpan={2} />
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.derived.composition?.perdues ?? null, 2, locale)}</td>
                  <td className="px-3 py-1.5 text-right">{fmtNum(r.pctReported.perdues, 2, locale)}</td>
                  <td />
                </tr>
                <tr className="border-t-2 border-line-strong font-semibold">
                  <td className="px-3 py-2">Total impropis</td>
                  <td className="px-3 py-2 text-right">{fmtNum(r.improperKgReported, 2, locale)}</td>
                  <td />
                  <td className="px-3 py-2 text-right">{fmtNum(r.derived.correctedImproperKg, 2, locale)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(r.derived.impropisPct, 2, locale)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(r.pctReported.impropis, 2, locale)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <ChartCard
            title="Com se situa aquesta mostra dins l'historial del circuit?"
            subtitle={`${history.length} mostres analitzables del circuit · rombes: anomalia robusta (|z| ≥ 3,5) · cercle: aquesta mostra`}
            csvName={`historial-${r.id}`}
            table={{ columns: [{ key: "id", label: "Butlletí" }, { key: "date", label: "Data" }, { key: "value", label: "% impropis", align: "right" }], rows: history.map((x) => ({ id: x.id, date: x.dates.sampling, value: x.derived.impropisPct })) }}
          >
            <SampleScatter highlightId={r.id} points={history.map((x) => ({ id: x.id, date: x.dates.sampling!, value: x.derived.impropisPct!, flagged: flagged.has(x.id) }))} />
          </ChartCard>
        </div>
      ),
    },
    {
      value: "fotos",
      label: "Fotografies",
      content: (
        <div className="p-4 sm:p-5">
          <BulletinGallery bulletinId={r.id} modeQuery={modeQuery} />
        </div>
      ),
    },
    {
      value: "observacions",
      label: "Observacions",
      content: (
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <h3 className="text-[13px] font-semibold">Observacions de la caracterització</h3>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">{r.observations.characterization ?? "—"}</p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold">Observacions «altres residus»</h3>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted">{r.observations.otherWaste ?? "—"}</p>
          </div>
          <Note tone="neutral" className="sm:col-span-2">
            <p className="font-medium">Indicadors de malbaratament alimentari (subestructura de la mostra; no se sumen a la composició)</p>
            <p className="tabular">
              Malbaratament total: {fmtNum(r.food.wasteKg, 2, locale)} kg · sobre orgànica bruta: {fmtNum(r.food.wastePct, 2, locale)} % · residus alimentaris + compostables: {fmtNum(r.food.foodCompostablePct, 2, locale)} % · bosses compostables: {fmtNum(r.compostableBagsPct, 0, locale)} %
            </p>
          </Note>
          <p className="text-[11.5px] text-subtle sm:col-span-2">Text lliure de la font, mostrat com a dada (no s&apos;interpreta com a instrucció ni com a HTML).</p>
        </div>
      ),
    },
    {
      value: "qualitat",
      label: `Qualitat i traçabilitat${r.quality.length ? ` (${r.quality.length})` : ""}`,
      content: (
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
          <div>
            <h3 className="text-[13px] font-semibold">Incidències de qualitat</h3>
            {r.quality.length === 0 ? <p className="mt-1 text-[13px] text-muted">Cap regla activada.</p> : null}
            <ul className="mt-2 flex flex-col gap-2">
              {r.quality.map((q, i) => (
                <li key={i} className="rounded-lg border border-line px-3 py-2 text-[13px]">
                  <div className="flex items-center gap-2">
                    <Badge tone={q.severity === "error" ? "danger" : q.severity === "warning" ? "warn" : "info"}>
                      {q.severity === "error" ? "Error" : q.severity === "warning" ? "Avís" : "Info"} · {q.code}
                    </Badge>
                    <span className="text-[11.5px] text-subtle">{q.ruleVersion}</span>
                  </div>
                  <p className="mt-1 text-muted">{q.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px]">
              Estat analític: {analyzable ? <Badge tone="brand">Inclosa a l&apos;anàlisi</Badge> : <Badge tone="warn">Exclosa de l&apos;anàlisi</Badge>}
            </p>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold">Procedència</h3>
            <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
              <dt className="text-muted">Mode de dades</dt>
              <dd>{ctx.t(`mode.${r.mode}`)}</dd>
              <dt className="text-muted">Snapshot</dt>
              <dd className="break-all">{r.source.snapshotId}</dd>
              <dt className="text-muted">Captura</dt>
              <dd>{fmtInstant(r.source.capturedAt, locale)}</dd>
              <dt className="text-muted">Fitxer raw</dt>
              <dd className="break-all">{r.source.file ?? "—"} {r.source.line ? `(línia ${r.source.line})` : ""}</dd>
              <dt className="text-muted">SHA-256 fitxer</dt>
              <dd className="break-all font-mono text-[11px]">{r.source.sha256 ?? "—"}</dd>
              <dt className="text-muted">Hash de fila</dt>
              <dd className="font-mono text-[11px]">{r.source.rowHash}</dd>
              <dt className="text-muted">Parser</dt>
              <dd>{r.source.parserVersion}</dd>
              <dt className="text-muted">Revisions</dt>
              <dd>{r.revisions?.length ? r.revisions.map((v) => `${v.capturedAt.slice(0, 10)}: ${v.changedFields.join(", ")}`).join(" · ") : "Cap canvi detectat entre captures"}</dd>
            </dl>
          </div>
        </div>
      ),
    },
  ];

  return (
    <PageFrame
      ctx={ctx}
      title={`Butlletí ${r.id} · ${r.circuitName}`}
      description={
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">{r.stream}</Badge>
          <Badge>Protocol: {r.protocolVersion}</Badge>
          <Badge>{r.status ?? "estat desconegut"}</Badge>
          {r.mode === "synthetic_demo" ? <Badge tone="synthetic">Registre sintètic</Badge> : null}
        </span>
      }
      actions={
        <>
          <Link href={scopedHref("/caracteritzacions", filters)} className={linkButtonClass("ghost", "sm")}>
            <ArrowLeft size={15} aria-hidden /> Explorador
          </Link>
          {isPublic ? (
            <a href={officialBulletinUrl(r.id)} target="_blank" rel="noreferrer noopener" className={linkButtonClass("secondary", "sm")}>
              {ctx.t("common.official")} <ExternalLink size={13} aria-hidden />
            </a>
          ) : null}
          <AddToReportButton item={{ kind: "sample", title: `Butlletí ${r.id} · ${r.circuitName}`, sampleIds: [r.id], text: `Mostra del ${fmtDate(r.dates.sampling)}: ${fmtNum(r.derived.impropisPct, 2)} % impropis (massa de referència ${fmtNum(ref, 1)} kg).`, filters: { ...filters } }} />
          <Link href={`/assistent${filtersToQuery(filters, { circuit: r.circuitKey })}&sample=${r.id}`} className={linkButtonClass("secondary", "sm")}>
            <Bot size={15} aria-hidden /> {ctx.t("common.ask")}
          </Link>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Identificació" as="h2" />
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 px-5 pb-5 pt-3 text-[13px]">
            <dt className="text-muted">Circuit</dt>
            <dd className="font-medium">{r.circuitName}</dd>
            <dt className="text-muted">Ens titular</dt>
            <dd>{r.titular ?? "—"}</dd>
            <dt className="text-muted">Municipis</dt>
            <dd>
              {r.municipalities.map((m) => m.name ?? `${m.raw} (no resolt)`).join(", ") || "—"}
              <span className="block text-[11.5px] text-subtle">
                Atribució: {r.attribution === "municipal" ? "municipal" : r.attribution === "comarcal" ? "comarcal (circuit multimunicipal)" : r.attribution === "supracomarcal" ? "circuit supracomarcal (no es reparteix)" : "no resolta"}
              </span>
            </dd>
            <dt className="text-muted">Comarca</dt>
            <dd>{r.comarcaCode ? ctx.comarques.get(r.comarcaCode) ?? r.comarcaCode : "—"}</dd>
            <dt className="text-muted">Instal·lació</dt>
            <dd>
              {r.facility ?? "—"}
              <span className="block text-[11.5px] text-subtle">Lloc de caracterització, no origen del residu</span>
            </dd>
            <dt className="text-muted">Empresa</dt>
            <dd>{r.company ?? "—"}</dd>
            <dt className="text-muted">Lot</dt>
            <dd>{r.lot ?? "—"}</dd>
            <dt className="text-muted">Recollida</dt>
            <dd>
              {r.collectionType ?? "—"} · {r.formType ?? "—"}
            </dd>
            <dt className="text-muted">Butlletí</dt>
            <dd>
              {r.bulletinYear} · T{r.bulletinQuarter}
            </dd>
            <dt className="text-muted">Recepció</dt>
            <dd>
              {fmtDate(r.dates.reception, locale)} · {fmtNum(r.dischargedKg, 0, locale)} kg descarregats
            </dd>
            <dt className="text-muted">Presa de mostra</dt>
            <dd className="font-medium">{fmtDate(r.dates.sampling, locale)}</dd>
            <dt className="text-muted">Caracterització</dt>
            <dd>{fmtDate(r.dates.characterization, locale)}</dd>
            <dt className="text-muted">Presentació</dt>
            <dd>{fmtDate(r.dates.presentation, locale)}</dd>
            <dt className="text-muted">Acceptació</dt>
            <dd>{fmtDate(r.dates.acceptance, locale)}</dd>
            <dt className="text-muted">% impropis</dt>
            <dd className="text-[18px] font-semibold">{fmtNum(r.derived.impropisPct, 2, locale)} %</dd>
          </dl>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <Tabs tabs={tabs} />
        </Card>
      </div>
    </PageFrame>
  );
}
