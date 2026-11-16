"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Columns2, X } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import type { PhotoRecord } from "@/lib/data/types";
import { PhotoViewer, Thumb } from "./photo-gallery";

export interface ArchiveBulletin {
  id: string;
  circuit: string;
  date: string | null;
  impropis: number | null;
  photos: PhotoRecord[];
}

export function ArchiveGrid({ bulletins, detailQuery }: { bulletins: ArchiveBulletin[]; detailQuery: string }) {
  const [viewer, setViewer] = useState<{ photos: PhotoRecord[]; index: number } | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 2 ? [c[1]!, id] : [...c, id]));
  const compared = useMemo(() => compare.map((id) => bulletins.find((b) => b.id === id)).filter((b): b is ArchiveBulletin => !!b), [compare, bulletins]);

  if (!bulletins.length)
    return (
      <EmptyState title="No hi ha fotografies indexades per a aquest àmbit">
        Les galeries s&apos;indexen amb un job limitat. Pots consultar-les en viu des de la fitxa de cada butlletí, o ampliar l&apos;índex amb <code>npm run ingest:photos</code>.
      </EmptyState>
    );

  return (
    <div className="flex flex-col gap-5">
      {compared.length === 2 ? (
        <div className="rounded-xl border border-line-strong bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[14px] font-semibold"><Columns2 size={16} aria-hidden /> Comparació entre mostres</p>
            <Button size="sm" variant="ghost" onClick={() => setCompare([])}><X size={14} aria-hidden /> Tancar</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {compared.map((b) => (
              <div key={b.id} className="min-w-0">
                <p className="mb-2 text-[13px]">
                  <Link href={`/caracteritzacions/${b.id}${detailQuery}`} className="font-semibold text-brand-dark hover:underline dark:text-[var(--focus)]">{b.id}</Link> · {b.circuit} · {b.date ?? "—"} · <strong>{b.impropis?.toFixed(2) ?? "—"} %</strong> impropis
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {b.photos.filter((p) => p.kind === "mostra" || p.kind === "impropi").slice(0, 9).map((p) => (
                    <Thumb key={p.imageId} photo={p} onOpen={() => setViewer({ photos: b.photos, index: b.photos.indexOf(p) })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : compare.length === 1 ? (
        <p className="text-[13px] text-muted">Selecciona una segona mostra per comparar.</p>
      ) : null}
      {bulletins.map((b) => (
        <section key={b.id} aria-label={`Butlletí ${b.id}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link href={`/caracteritzacions/${b.id}${detailQuery}`} className="text-[14px] font-semibold text-brand-dark hover:underline dark:text-[var(--focus)]">
              {b.id}
            </Link>
            <span className="text-[13px] text-ink">{b.circuit}</span>
            <span className="text-[12.5px] text-muted">{b.date ?? "—"}</span>
            <Badge>{b.impropis?.toFixed(2) ?? "—"} % impropis</Badge>
            <button onClick={() => toggle(b.id)} aria-pressed={compare.includes(b.id)} className={cn("ml-auto rounded-md border px-2 py-1 text-[12px] font-medium", compare.includes(b.id) ? "border-brand-dark bg-brand-tint text-brand-dark" : "border-line text-muted hover:text-ink")}>
              {compare.includes(b.id) ? "Seleccionada" : "Comparar"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {b.photos.map((p, i) => (
              <Thumb key={p.imageId} photo={p} onOpen={() => setViewer({ photos: b.photos, index: i })} />
            ))}
          </div>
        </section>
      ))}
      {viewer ? <PhotoViewer photos={viewer.photos} index={viewer.index} onIndex={(i) => setViewer({ ...viewer, index: i })} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}

