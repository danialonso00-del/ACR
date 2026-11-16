"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search, TriangleAlert } from "lucide-react";
import { Badge, Button, inputClass, selectClass } from "@/components/ui/primitives";
import { InfoPopover } from "@/components/ui/overlays";
import { cn } from "@/lib/format";
import type { ExplorerRow } from "./rows";

const nf = (v: number | null, d: number) => (v === null ? "—" : new Intl.NumberFormat("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
const dt = (s: string | null) => (s ? s.split("-").reverse().join("/") : "—");

const COLUMN_LABELS: Record<string, string> = {
  id: "Butlletí",
  circuit: "Circuit",
  titular: "Ens titular",
  municipalities: "Municipis",
  comarca: "Comarca",
  sampling: "Presa de mostra",
  characterization: "Caracterització",
  bulletin: "Període butlletí",
  company: "Empresa",
  facility: "Instal·lació",
  formType: "Tipus FORM",
  collectionType: "Recollida",
  referenceKg: "Massa ref. (kg)",
  impropisPct: "% impropis",
  issues: "Qualitat",
  photos: "Fotos",
  protocol: "Protocol",
};
const DEFAULT_HIDDEN: VisibilityState = { titular: false, municipalities: false, characterization: false, bulletin: false, company: false, formType: false, collectionType: false, protocol: false };

export function ExplorerTable({ baseQuery }: { baseQuery: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sorting, setSorting] = useState<SortingState>([{ id: "sampling", desc: true }]);
  const [visibility, setVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem("arc_explorer_cols");
      return saved ? (JSON.parse(saved) as VisibilityState) : DEFAULT_HIDDEN;
    } catch {
      return DEFAULT_HIDDEN;
    }
  });
  const [data, setData] = useState<{ total: number; rows: ExplorerRow[]; dataset: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [baseQuery]);
  useEffect(() => {
    try {
      localStorage.setItem("arc_explorer_cols", JSON.stringify(visibility));
    } catch {
      /* per-viewer convenience only */
    }
  }, [visibility]);

  const params = useMemo(() => {
    const p = new URLSearchParams(baseQuery.replace(/^\?/, ""));
    if (debounced) p.set("q", debounced);
    const s = sorting[0];
    if (s) {
      p.set("sort", s.id);
      p.set("dir", s.desc ? "desc" : "asc");
    }
    return p;
  }, [baseQuery, debounced, sorting]);

  useEffect(() => {
    const ctrl = new AbortController();
    const p = new URLSearchParams(params);
    p.set("page", String(page));
    p.set("size", String(size));
    setLoading(true);
    setError(null);
    fetch(`/api/characterizations?${p.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e: Error) => e.name !== "AbortError" && setError(e.message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [params, page, size]);

  const detailHref = (id: string) => `/caracteritzacions/${id}${baseQuery}`;
  const columns = useMemo<ColumnDef<ExplorerRow>[]>(
    () => [
      { accessorKey: "id", header: COLUMN_LABELS.id, cell: (c) => <Link href={detailHref(c.row.original.id)} className="font-medium text-brand-dark hover:underline dark:text-[var(--focus)]">{c.row.original.id}</Link>, enableHiding: false },
      { accessorKey: "circuit", header: COLUMN_LABELS.circuit, cell: (c) => <span className="block max-w-[240px] truncate" title={c.row.original.circuit}>{c.row.original.circuit}</span>, enableHiding: false },
      { accessorKey: "titular", header: COLUMN_LABELS.titular, cell: (c) => <span className="block max-w-[220px] truncate">{c.row.original.titular ?? "—"}</span> },
      { accessorKey: "municipalities", header: COLUMN_LABELS.municipalities, enableSorting: false, cell: (c) => <span className="block max-w-[240px] truncate" title={c.row.original.municipalities}>{c.row.original.municipalities || "—"}</span> },
      {
        accessorKey: "comarca",
        header: COLUMN_LABELS.comarca,
        cell: (c) => c.row.original.comarca ?? <span className="text-subtle">{c.row.original.attribution === "supracomarcal" ? "supracomarcal" : "no resolta"}</span>,
      },
      { accessorKey: "sampling", header: COLUMN_LABELS.sampling, cell: (c) => dt(c.row.original.sampling) },
      { accessorKey: "characterization", header: COLUMN_LABELS.characterization, cell: (c) => dt(c.row.original.characterization) },
      { accessorKey: "bulletin", header: COLUMN_LABELS.bulletin, enableSorting: false },
      { accessorKey: "company", header: COLUMN_LABELS.company, cell: (c) => <span className="block max-w-[200px] truncate">{c.row.original.company ?? "—"}</span> },
      { accessorKey: "facility", header: COLUMN_LABELS.facility, cell: (c) => <span className="block max-w-[220px] truncate" title={c.row.original.facility ?? ""}>{c.row.original.facility ?? "—"}</span> },
      { accessorKey: "formType", header: COLUMN_LABELS.formType, enableSorting: false },
      { accessorKey: "collectionType", header: COLUMN_LABELS.collectionType, enableSorting: false },
      { accessorKey: "referenceKg", header: COLUMN_LABELS.referenceKg, meta: { align: "right" }, cell: (c) => nf(c.row.original.referenceKg, 1) },
      {
        accessorKey: "impropisPct",
        header: COLUMN_LABELS.impropisPct,
        meta: { align: "right" },
        cell: (c) => <span className={cn("font-medium", !c.row.original.analyzable && "text-subtle line-through decoration-1")} title={c.row.original.analyzable ? undefined : "Exclosa de l'anàlisi"}>{nf(c.row.original.impropisPct, 2)}</span>,
      },
      {
        accessorKey: "issues",
        header: COLUMN_LABELS.issues,
        cell: (c) => {
          const r = c.row.original;
          if (r.severity === "error") return <Badge tone="danger"><TriangleAlert size={11} aria-hidden /> error</Badge>;
          if (r.issues) return <Badge tone="warn"><TriangleAlert size={11} aria-hidden /> {r.issues}</Badge>;
          return <Badge>OK</Badge>;
        },
      },
      { accessorKey: "photos", header: COLUMN_LABELS.photos, meta: { align: "right" }, cell: (c) => (c.row.original.photos === null ? <span className="text-subtle" title="Galeria no comprovada">n.c.</span> : c.row.original.photos) },
      { accessorKey: "protocol", header: COLUMN_LABELS.protocol, enableSorting: false },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseQuery],
  );

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: (u) => {
      setSorting(u);
      setPage(1);
    },
    onColumnVisibilityChange: setVisibility,
    manualSorting: true,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const exportHref = `/api/export/characterizations?${params.toString()}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
          <input className={cn(inputClass, "pl-8")} placeholder="Cercar butlletí, circuit, municipi, empresa…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cercar" />
        </div>
        <InfoPopover
          label="Columnes visibles"
          trigger={
            <Button variant="secondary" size="sm">
              <Columns3 size={15} aria-hidden /> Columnes
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {table
              .getAllLeafColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="accent-[var(--arc-green-dark)]" />
                  {COLUMN_LABELS[c.id] ?? c.id}
                </label>
              ))}
          </div>
        </InfoPopover>
        <a href={exportHref} className="press inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-[13px] font-medium text-ink hover:border-g-300 hover:bg-g-50" download>
          <Download size={15} aria-hidden /> Exportar CSV ({data?.total ?? "…"})
        </a>
        <span className="ml-auto text-[12.5px] text-muted" role="status" aria-live="polite">
          {loading ? "Carregant…" : data ? `${new Intl.NumberFormat("ca-ES").format(data.total)} registres · ${data.dataset}` : ""}
        </span>
      </div>
      {error ? <p className="px-4 text-[13px] text-danger">Error: {error}</p> : null}
      <div className={cn("overflow-x-auto border-y border-line transition-opacity duration-150", loading && "opacity-60")}>
        <table className="tabular w-full min-w-[860px] border-collapse text-[13px]">
          <thead className="bg-surface-2">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th key={h.id} scope="col" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"} className={cn("whitespace-nowrap px-3 py-2 text-[12px] font-semibold text-muted", align === "right" ? "text-right" : "text-left")}>
                      {h.column.getCanSort() ? (
                        <button onClick={h.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 hover:text-ink", align === "right" && "flex-row-reverse")}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp size={12} aria-hidden /> : sorted === "desc" ? <ArrowDown size={12} aria-hidden /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {!data && loading
              ? Array.from({ length: 10 }, (_, i) => (
                  <tr key={i} className="border-t border-line">
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="px-3 py-2.5">
                        <div className="skeleton h-3.5 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="cursor-pointer border-t border-line hover:bg-surface-2/70" onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) return; router.push(detailHref(row.original.id)); }}>
                    {row.getVisibleCells().map((cell) => {
                      const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                      return (
                        <td key={cell.id} className={cn("whitespace-nowrap px-3 py-2", align === "right" && "text-right")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            {data && data.rows.length === 0 ? (
              <tr>
                <td colSpan={20} className="px-3 py-10 text-center text-muted">Cap registre coincideix amb l&apos;àmbit i la cerca.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          Files per pàgina
          <select className={cn(selectClass, "h-8 w-20")} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Pàgina anterior">
            <ChevronLeft size={15} aria-hidden />
          </Button>
          <span className="tabular text-[13px] text-muted">
            Pàgina {page} de {pages}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Pàgina següent">
            <ChevronRight size={15} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
