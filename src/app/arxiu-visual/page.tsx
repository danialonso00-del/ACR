import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { PageFrame } from "@/components/shell/page-frame";
import { Badge, Card, CardHeader, Note } from "@/components/ui/primitives";
import { ArchiveGrid, type ArchiveBulletin } from "@/features/archive/archive-grid";
import { KIND_LABEL } from "@/lib/photo-kinds";
import { loadContext, type SearchParams } from "@/lib/context";
import { filtersToQuery } from "@/lib/analytics/filters";
import { fmtNum } from "@/lib/format";
import { scopedHref } from "@/lib/links";
import type { PhotoRecord } from "@/lib/data/types";

export const metadata = { title: "Arxiu visual" };
const KINDS = Object.keys(KIND_LABEL) as PhotoRecord["kind"][];
const PAGE = 8;

export default async function ArchivePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await loadContext(searchParams);
  const { scope, ds, locale, t } = ctx;
  if (!scope || !ds) return <PageFrame ctx={ctx} title={t("archive.title")}>{null}</PageFrame>;
  const f = scope.filters;
  const kind = typeof ctx.sp.kind === "string" && (KINDS as string[]).includes(ctx.sp.kind) ? (ctx.sp.kind as PhotoRecord["kind"]) : undefined;
  const page = Math.max(1, Number(ctx.sp.page) || 1);
  const inScope = new Map(scope.inScope.map((r) => [r.id, r]));
  const photos = ds.photos.filter((p) => inScope.has(p.bulletinId));
  const checked = [...ds.photoChecks.keys()].filter((id) => inScope.has(id));
  const byKind = Object.fromEntries(KINDS.map((k) => [k, photos.filter((p) => p.kind === k).length]));
  const filtered = kind ? photos.filter((p) => p.kind === kind) : photos;
  const bulletinIds = [...new Set(filtered.map((p) => p.bulletinId))].sort((a, b) => (inScope.get(b)!.dates.sampling ?? "").localeCompare(inScope.get(a)!.dates.sampling ?? ""));
  const pages = Math.max(1, Math.ceil(bulletinIds.length / PAGE));
  const bulletins: ArchiveBulletin[] = bulletinIds.slice((page - 1) * PAGE, page * PAGE).map((id) => {
    const r = inScope.get(id)!;
    return { id, circuit: r.circuitName, date: r.dates.sampling, impropis: r.derived.impropisPct, photos: filtered.filter((p) => p.bulletinId === id) };
  });
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(filtersToQuery(f).replace(/^\?/, ""));
    for (const [k, v] of Object.entries({ kind, ...extra })) if (v) p.set(k, v); else p.delete(k);
    return `/arxiu-visual?${p.toString()}`;
  };

  return (
    <PageFrame
      ctx={ctx}
      title={t("archive.title")}
      description="Fotografies públiques associades als butlletins (lot, identificació, mostra, fraccions i incidències), amb el tipus assignat al SDR. Les imatges absents o trencades es mostren com a tals; no es substitueixen per cap altra imatge."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Mostres a l'àmbit", fmtNum(scope.inScope.length, 0, locale)],
          ["Galeries comprovades", fmtNum(checked.length, 0, locale)],
          ["Amb fotografies", fmtNum(checked.filter((id) => (ds.photoChecks.get(id)?.photos ?? 0) > 0).length, 0, locale)],
          ["Fotografies indexades", fmtNum(photos.length, 0, locale)],
        ].map(([l, v]) => (
          <Card key={l} className="px-4 py-3">
            <p className="text-[12.5px] text-muted">{l}</p>
            <p className="tabular text-[22px] font-semibold">{v}</p>
          </Card>
        ))}
      </div>
      <Note tone="neutral" className="mb-4">
        Font: consulta pública del SDR (ARC). Permís conegut: consulta pública; condicions de reutilització, publicació i entrenament de models <strong>no confirmades</strong>. L&apos;índex cobreix un subconjunt limitat (job explícit); la cobertura històrica completa està pendent de validar.
      </Note>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Tipus de foto">
        <Link href={href({ kind: undefined, page: undefined })} className={`rounded-full border px-3 py-1 text-[12.5px] ${!kind ? "border-brand-dark bg-brand-tint font-medium text-brand-dark" : "border-line text-muted hover:text-ink"}`} aria-current={!kind ? "true" : undefined}>
          Totes ({photos.length})
        </Link>
        {KINDS.filter((k) => byKind[k]).map((k) => (
          <Link key={k} href={href({ kind: k, page: undefined })} className={`rounded-full border px-3 py-1 text-[12.5px] ${kind === k ? "border-brand-dark bg-brand-tint font-medium text-brand-dark" : "border-line text-muted hover:text-ink"}`} aria-current={kind === k ? "true" : undefined}>
            {KIND_LABEL[k]} ({byKind[k]})
          </Link>
        ))}
      </div>
      <Card className="p-4 sm:p-5">
        <ArchiveGrid bulletins={bulletins} detailQuery={filtersToQuery(f)} />
        {pages > 1 ? (
          <div className="mt-5 flex items-center justify-center gap-3 text-[13px]">
            {page > 1 ? <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href={href({ page: String(page - 1) })}>← Anterior</Link> : null}
            <span className="text-muted">Pàgina {page} de {pages}</span>
            {page < pages ? <Link className="rounded-md border border-line px-3 py-1.5 hover:bg-surface-2" href={href({ page: String(page + 1) })}>Següent →</Link> : null}
          </div>
        ) : null}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Laboratori de visió" subtitle="Fase posterior · no operatiu en aquesta demo" actions={<Badge tone="warn"><FlaskConical size={12} aria-hidden /> Prototip no operatiu</Badge>} />
        <div className="grid gap-4 px-5 pb-5 pt-3 text-[13px] leading-relaxed md:grid-cols-3">
          <div>
            <p className="font-semibold">Què es preveu</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              <li>Etiquetatge assistit i cerca visual.</li>
              <li>Detecció orientativa de materials.</li>
              <li>Etiquetes manuals separades de prediccions, amb versió del model, confiança i revisió.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Què no farà</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              <li>Convertir àrea de píxels en kg.</li>
              <li>Presentar una detecció com a pesada certificada.</li>
              <li>Entrenar models sense confirmar drets d&apos;ús de les imatges.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Com s&apos;avaluaria</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              <li>Particions per campanya/circuit/temps sense duplicats (hash) entre entrenament i prova.</li>
              <li>Precisió per classe i domini.</li>
              <li>Fotos post-triatge ≠ residu barrejat abans del triatge: cal validar-ho per separat.</li>
            </ul>
          </div>
        </div>
        <p className="px-5 pb-4 text-[12px] text-subtle">
          Les galeries s&apos;indexen per butlletins existents (no s&apos;enumeren identificadors). <Link className="underline" href={scopedHref("/fonts", f)}>Cobertura per any</Link>
        </p>
      </Card>
    </PageFrame>
  );
}
