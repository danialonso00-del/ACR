"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";

export interface MapShape {
  code: string;
  name: string;
  path: string;
  centroid: [number, number];
}

export interface MapValue {
  value: number | null;
  n: number;
  circuits: number;
  sufficient: boolean;
}

/** Fixed breaks (in % impropis) so maps stay comparable when filters change. Blue sequential ramp: green is never used where it could read as «favourable». */
export const MAP_BREAKS = [3, 6, 9, 12, 15];
const RAMP = ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"];
const nf = (v: number, d = 1) => new Intl.NumberFormat("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

function classOf(v: number) {
  let i = 0;
  while (i < MAP_BREAKS.length && v >= MAP_BREAKS[i]!) i++;
  return i;
}

export function Choropleth({ shapes, viewBox, values, selected, minN, fictitious = false, height = 420 }: { shapes: MapShape[]; viewBox: [number, number, number, number]; values: Record<string, MapValue>; selected?: string; minN: number; fictitious?: boolean; height?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  const select = (code: string) => {
    const next = new URLSearchParams(sp.toString());
    if (selected === code) next.delete("comarca");
    else next.set("comarca", code);
    next.delete("circuit");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const h = hover ? shapes.find((s) => s.code === hover.code) : null;
  const hv = h ? values[h.code] : undefined;

  return (
    <div className="relative">
      <svg viewBox={viewBox.join(" ")} role="group" aria-label={fictitious ? "Mapa esquemàtic de territoris fictius" : "Mapa de comarques de Catalunya (ICGC)"} className="h-auto w-full" style={{ maxHeight: height }}>
        <defs>
          <pattern id="nodata" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="var(--nodata)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--axis)" strokeWidth="1.4" />
          </pattern>
          <pattern id="lown" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill="var(--nodata)" />
            <circle cx="3.5" cy="3.5" r="1.1" fill="var(--subtle)" />
          </pattern>
        </defs>
        {shapes.map((s) => {
          const v = values[s.code];
          const fill = !v || v.n === 0 || v.value === null ? "url(#nodata)" : !v.sufficient ? "url(#lown)" : RAMP[classOf(v.value)]!;
          const isSel = selected === s.code;
          const label = !v || v.n === 0 ? "sense dades" : !v.sufficient ? `n insuficient (${v.n})` : `${nf(v.value!, 1)} % impropis, n = ${v.n}`;
          return (
            <path
              key={s.code}
              d={s.path}
              fill={fill}
              stroke={isSel ? "var(--ink)" : "var(--surface)"}
              strokeWidth={isSel ? 2.4 : 0.9}
              strokeLinejoin="round"
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={`${s.name}: ${label}`}
              className="cursor-pointer outline-none transition-[opacity] duration-150 hover:opacity-80 focus-visible:opacity-80"
              onMouseMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ code: s.code, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
              onMouseLeave={() => setHover(null)}
              onFocus={(e) => {
                const svg = e.currentTarget.ownerSVGElement as SVGSVGElement;
                const r = svg.getBoundingClientRect();
                setHover({ code: s.code, x: ((s.centroid[0] - viewBox[0]) / viewBox[2]) * r.width, y: ((s.centroid[1] - viewBox[1]) / viewBox[3]) * r.height });
              }}
              onBlur={() => setHover(null)}
              onClick={() => select(s.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(s.code);
                }
              }}
            />
          );
        })}
        {fictitious
          ? shapes.map((s) => (
              <text key={s.code} x={s.centroid[0]} y={s.centroid[1]} textAnchor="middle" className="pointer-events-none fill-[var(--ink)] text-[22px] font-semibold">
                {s.code}
              </text>
            ))
          : null}
      </svg>
      {h && hover ? (
        <div className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]" style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12 }}>
          <p className="font-semibold text-ink">{h.name}</p>
          {!hv || hv.n === 0 ? (
            <p className="text-muted">Sense dades atribuïdes</p>
          ) : (
            <p className="tabular text-muted">
              {hv.value === null ? "—" : `${nf(hv.value, 2)} % impropis`}
              <br />n = {hv.n} mostres · {hv.circuits} circuits
              {!hv.sufficient ? <><br /><span className="text-warn">n &lt; {minN}: no es pinta el valor</span></> : null}
            </p>
          )}
        </div>
      ) : null}
      <MapLegend minN={minN} />
    </div>
  );
}

export function MapLegend({ minN }: { minN: number }) {
  const labels = ["< 3", "3–6", "6–9", "9–12", "12–15", "≥ 15"];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-muted" aria-label="Llegenda del mapa">
      <div className="flex items-center gap-1.5">
        <span className="mr-1">% impropis</span>
        {RAMP.map((c, i) => (
          <span key={c} className="flex flex-col items-center gap-0.5">
            <span className="h-3 w-7 rounded-sm" style={{ background: c }} />
            <span className="tabular text-[10.5px]">{labels[i]}</span>
          </span>
        ))}
      </div>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" aria-hidden>
          <rect width="18" height="12" rx="2" fill="url(#nodata)" stroke="var(--axis)" strokeWidth="0.5" />
        </svg>
        Sense dades
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" aria-hidden>
          <rect width="18" height="12" rx="2" fill="url(#lown)" stroke="var(--axis)" strokeWidth="0.5" />
        </svg>
        n &lt; {minN}
      </span>
      <span className={cn("text-subtle")}>Clic en una comarca per filtrar</span>
    </div>
  );
}
