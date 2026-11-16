import Link from "next/link";
import { FileText } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { NewInvestigation } from "@/features/reports/new-investigation";
import { listReports } from "@/features/reports/store";
import { loadContext, scopeDescription, type SearchParams } from "@/lib/context";
import { fmtInstant } from "@/lib/format";

export const metadata = { title: "Informes" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const reports = listReports();
  const f = ctx.scope?.filters ?? ctx.filters;
  return (
    <PageFrame
      ctx={ctx}
      title={ctx.t("reports.title")}
      description="Defineix una pregunta, revisa l'abast i les fonts proposades, executa l'anàlisi i obtén un dossier verificable (resum, gràfics, troballes, hipòtesis, limitacions i propers passos) exportable a PDF i CSV."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Nova investigació" subtitle="Les xifres es calculen en codi; el text és generat amb plantilles a partir dels resultats." />
          <NewInvestigation
            filters={{ ...f }}
            scopeLabel={scopeDescription(ctx)}
            synthetic={ctx.filters.mode === "synthetic_demo"}
            sources={[
              { name: ctx.ds?.meta.label ?? "—", status: ctx.filters.mode === "public_snapshot" ? `Verificada · captura ${ctx.ds?.meta.capturedTo?.slice(0, 10) ?? "—"}` : ctx.filters.mode === "synthetic_demo" ? "Sintètica" : "Importada" },
              { name: "Metodologia i diccionari (docs/)", status: "Documentació del projecte" },
            ]}
            analyses={[
              "Agregat d'impropis, cobertura i exclusions",
              "Sèrie anual amb buits explícits i composició per categoria",
              "Canvi 12 m (cohort estable i per circuit amb IC 95 %)",
              "Canvis persistents, anomalies robustes i estacionalitat",
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Investigacions desades" subtitle={`${reports.length} informes · emmagatzematge local de la demo`} />
          {reports.length === 0 ? (
            <EmptyState title="Encara no hi ha informes" icon={<FileText size={22} />}>
              Crea&apos;n un amb el formulari o afegeix elements des de l&apos;assistent o des d&apos;una fitxa de mostra.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line px-2 py-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/informes/${r.id}`} className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 hover:bg-surface-2">
                    <span className="text-[14px] font-medium text-ink">{r.title}</span>
                    <span className="text-[12px] text-muted">{r.scopeLabel}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-subtle">
                      {r.mode === "synthetic_demo" ? <Badge tone="synthetic">sintètic</Badge> : null}
                      {r.findings} troballes · {r.items} elements · actualitzat {fmtInstant(r.updatedAt, ctx.locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageFrame>
  );
}
