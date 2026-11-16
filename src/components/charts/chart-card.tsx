"use client";
import { useMemo, useRef, useState } from "react";
import { Download, Info, Table2, BarChart3, ImageDown } from "lucide-react";
import type * as echarts from "echarts/core";
import { Card, CardHeader } from "@/components/ui/primitives";
import { InfoPopover } from "@/components/ui/overlays";
import { ChartRegistryContext } from "./echart";
import { toCsv, type CsvCell } from "@/lib/csv";
import { cn } from "@/lib/format";

export interface TableSpec {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, CsvCell>[];
  meta?: string[];
}

export function downloadBlob(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataTable({ spec, maxHeight = 360, caption }: { spec: TableSpec; maxHeight?: number; caption?: string }) {
  return (
    <div className="overflow-auto rounded-lg border border-line" style={{ maxHeight }}>
      <table className="tabular w-full border-collapse text-[12.5px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {spec.columns.map((c) => (
              <th key={c.key} scope="col" className={cn("whitespace-nowrap border-b border-line px-3 py-2 font-semibold text-muted", c.align === "right" ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 hover:bg-surface-2/60">
              {spec.columns.map((c) => (
                <td key={c.key} className={cn("whitespace-nowrap px-3 py-1.5 text-ink", c.align === "right" && "text-right")}>
                  {r[c.key] === null || r[c.key] === undefined || r[c.key] === "" ? (
                    <span className="text-subtle">—</span>
                  ) : typeof r[c.key] === "number" ? (
                    (r[c.key] as number).toLocaleString("ca-ES", { maximumFractionDigits: 3, useGrouping: false })
                  ) : (
                    String(r[c.key])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  methodology,
  table,
  csvName,
  children,
  className,
  footer,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  methodology?: React.ReactNode;
  table?: TableSpec;
  csvName?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const chartRef = useRef<echarts.ECharts | null>(null);
  const registry = useMemo(() => ({ set: (c: echarts.ECharts | null) => (chartRef.current = c) }), []);
  const downloadCsv = () => {
    if (!table) return;
    const csv = toCsv(
      table.columns.map((c) => c.label),
      table.rows.map((r) => table.columns.map((c) => r[c.key])),
      [title, ...(table.meta ?? [])],
    );
    downloadBlob(csv, `${csvName ?? "dades"}.csv`, "text/csv;charset=utf-8");
  };
  const downloadImage = () => {
    const url = chartRef.current?.getDataURL({ type: "svg" } as never);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName ?? "grafic"}.svg`;
    a.click();
  };
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            {methodology ? (
              <InfoPopover
                label="Metodologia"
                trigger={
                  <button className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-ink" aria-label="Metodologia">
                    <Info size={16} aria-hidden />
                  </button>
                }
              >
                {methodology}
              </InfoPopover>
            ) : null}
            {table ? (
              <button
                onClick={() => setView(view === "chart" ? "table" : "chart")}
                className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-ink"
                aria-label={view === "chart" ? "Mostrar taula" : "Mostrar gràfic"}
                aria-pressed={view === "table"}
                title={view === "chart" ? "Taula" : "Gràfic"}
              >
                {view === "chart" ? <Table2 size={16} aria-hidden /> : <BarChart3 size={16} aria-hidden />}
              </button>
            ) : null}
            {table ? (
              <button onClick={downloadCsv} className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-ink" aria-label="Descarregar CSV" title="CSV">
                <Download size={16} aria-hidden />
              </button>
            ) : null}
            <button onClick={downloadImage} className="grid h-8 w-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-ink" aria-label="Descarregar imatge (SVG)" title="SVG">
              <ImageDown size={16} aria-hidden />
            </button>
          </>
        }
      />
      <div className="min-w-0 flex-1 px-3 pb-3 pt-2 sm:px-4">
        <ChartRegistryContext.Provider value={registry}>
          <div className={view === "table" ? "hidden" : ""}>{children}</div>
        </ChartRegistryContext.Provider>
        {view === "table" && table ? <DataTable spec={table} caption={title} /> : null}
      </div>
      {footer ? <div className="border-t border-line px-5 py-2.5 text-[12px] text-muted">{footer}</div> : null}
    </Card>
  );
}
