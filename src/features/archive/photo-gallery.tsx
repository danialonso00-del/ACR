"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "@/components/ui/overlays";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import type { PhotoRecord } from "@/lib/data/types";
import { KIND_LABEL } from "@/lib/photo-kinds";

export { KIND_LABEL };

type GalleryResponse = { status: string; photos: PhotoRecord[]; capturedAt?: string; message?: string };

export function useGallery(bulletinId: string, modeQuery: string) {
  const key = `${bulletinId}${modeQuery}`;
  // State is tagged with the request key so a new bulletin never shows stale photos.
  const [state, setState] = useState<{ key: string; data: GalleryResponse | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/photos/${bulletinId}${modeQuery}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: GalleryResponse) => setState({ key, data, error: null }))
      .catch((e: Error) => e.name !== "AbortError" && setState({ key, data: null, error: e.message }));
    return () => ctrl.abort();
  }, [bulletinId, modeQuery, key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: null, error: null };
}

export function Thumb({ photo, onOpen, className }: { photo: PhotoRecord; onOpen?: () => void; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <button onClick={onOpen} className={cn("group relative block overflow-hidden rounded-lg border border-line bg-surface-2 text-left", className)} aria-label={`Obrir foto ${photo.order}: ${photo.typeLabel ?? KIND_LABEL[photo.kind]}`}>
      <div className="aspect-[4/3] w-full">
        {broken ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-subtle">
            <ImageOff size={20} aria-hidden />
            <span className="text-[11px]">Imatge no disponible</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- proxied third-party image, dimensions unknown
          <img src={`/api/photo-image/${photo.imageId}`} alt={`${photo.typeLabel ?? KIND_LABEL[photo.kind]} · butlletí ${photo.bulletinId}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" onError={() => setBroken(true)} />
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <span className="truncate text-[11.5px] text-muted" title={photo.typeLabel ?? ""}>
          {photo.typeLabel ?? "Sense tipus"}
        </span>
        <Badge tone={photo.kind === "impropi" ? "warn" : photo.kind === "incidencia" ? "info" : "neutral"} className="shrink-0 px-1.5 text-[10.5px]">
          {KIND_LABEL[photo.kind]}
        </Badge>
      </div>
    </button>
  );
}

export function PhotoViewer({ photos, index, onIndex, onClose }: { photos: PhotoRecord[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  // Zoom and error state belong to the photo shown; keyed by index so they reset on navigation.
  const [zoomFor, setZoomFor] = useState<number | null>(null);
  const [brokenFor, setBrokenFor] = useState<number | null>(null);
  const zoom = zoomFor === index;
  const broken = brokenFor === index;
  const setZoom = (z: boolean) => setZoomFor(z ? index : null);
  const setBroken = () => setBrokenFor(index);
  const p = index !== null ? photos[index] : null;
  const go = useCallback((d: number) => index !== null && onIndex((index + d + photos.length) % photos.length), [index, onIndex, photos.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (index === null) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);
  if (!p) return null;
  return (
    <Modal open={index !== null} onOpenChange={(o) => !o && onClose()} title={`Butlletí ${p.bulletinId} · foto ${p.order} de ${photos.length} · ${p.typeLabel ?? KIND_LABEL[p.kind]}`}>
      <div className="flex flex-col gap-3 p-4">
        <div className={cn("relative flex max-h-[68vh] min-h-[300px] items-center justify-center rounded-xl bg-[#111] ", zoom ? "overflow-auto" : "overflow-hidden")}>
          {broken ? (
            <EmptyState title="Imatge no disponible" icon={<ImageOff size={24} />}>
              No s&apos;ha pogut obtenir la imatge de la font. No se substitueix per cap altra imatge.
            </EmptyState>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- proxied third-party image
            <img src={`/api/photo-image/${p.imageId}?size=full`} alt={`${p.typeLabel ?? KIND_LABEL[p.kind]} · butlletí ${p.bulletinId}`} className={cn("transition-transform duration-200", zoom ? "max-w-none origin-top-left scale-[1.8] cursor-zoom-out" : "max-h-[68vh] max-w-full cursor-zoom-in object-contain")} onClick={() => setZoom(!zoom)} onError={() => setBroken()} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" onClick={() => go(-1)} aria-label="Foto anterior">
              <ChevronLeft size={15} aria-hidden />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => go(1)} aria-label="Foto següent">
              <ChevronRight size={15} aria-hidden />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setZoom(!zoom)} aria-pressed={zoom}>
              {zoom ? <ZoomOut size={15} aria-hidden /> : <ZoomIn size={15} aria-hidden />} {zoom ? "Ajustar" : "Ampliar"}
            </Button>
          </div>
          <a href={`https://sdr.arc.cat/cform/EditCaracteritzacionsImatges.do?caractId=${p.bulletinId}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-dark hover:underline dark:text-[var(--focus)]">
            Galeria oficial al SDR <ExternalLink size={13} aria-hidden />
          </a>
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-[12px] text-muted sm:grid-cols-3">
          <div>
            <dt className="inline font-medium text-ink">Tipus (SDR): </dt>
            <dd className="inline">{p.typeLabel ?? "no assignat"}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">Indexada: </dt>
            <dd className="inline">{p.capturedAt.slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-ink">Id imatge: </dt>
            <dd className="inline">{p.imageId}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="inline font-medium text-ink">Permís conegut: </dt>
            <dd className="inline">{p.rights}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

export function BulletinGallery({ bulletinId, modeQuery }: { bulletinId: string; modeQuery: string }) {
  const { data, error } = useGallery(bulletinId, modeQuery);
  const [open, setOpen] = useState<number | null>(null);
  if (error) return <EmptyState title="No s'ha pogut consultar la galeria">{error}</EmptyState>;
  if (!data)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton aspect-[4/3]" />
        ))}
      </div>
    );
  if (!data.photos.length)
    return (
      <EmptyState title={data.status === "indexed" || data.status === "live" || data.status === "cached" ? "La galeria pública d'aquest butlletí no té imatges" : "Fotografies no disponibles"} icon={<ImageOff size={22} />}>
        {data.message ?? `Galeria comprovada el ${data.capturedAt?.slice(0, 10)}.`}
      </EmptyState>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        {data.photos.length} imatges · origen: {data.status === "indexed" ? "índex de l'extracte" : data.status === "live" ? "lectura en viu del SDR" : "memòria cau local"} ({data.capturedAt?.slice(0, 10)}) · drets de reutilització no confirmats
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.photos.map((p, i) => (
          <Thumb key={p.imageId} photo={p} onOpen={() => setOpen(i)} />
        ))}
      </div>
      <PhotoViewer photos={data.photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </div>
  );
}
