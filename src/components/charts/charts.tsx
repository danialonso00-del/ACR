"use client";
/**
 * Reusable chart forms. Each takes plain data (serialisable from server
 * components) and builds an ECharts option from the theme tokens.
 * Rules: one y-axis per chart, gaps are never interpolated, ≤ 8 categorical
 * series in fixed palette order, legends always present for ≥ 2 series.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { EChart, axisStyle, baseOption, useChartTheme, type ChartTheme } from "./echart";
import { CHART_GROUPS } from "@/lib/categories";

const nf = (v: number, d = 1) => new Intl.NumberFormat("ca-ES", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export interface TrendPoint {
  bucket: string;
  value: number | null;
  p25: number | null;
  p75: number | null;
  n: number;
  circuits: number;
}

function bucketRange(b: string): [string, string] {
  if (/^\d{4}$/.test(b)) return [`${b}-01`, `${b}-12`];
  const q = b.match(/^(\d{4})-T(\d)$/);
  if (q) {
    const m = (Number(q[2]) - 1) * 3 + 1;
    return [`${q[1]}-${String(m).padStart(2, "0")}`, `${q[1]}-${String(m + 2).padStart(2, "0")}`];
  }
  return [b, b];
}

/** href to the explorer for a bucket, keeping the rest of the scope. */
export function bucketHref(base: string, bucket: string) {
  const [path, q = ""] = base.split("?");
  const params = new URLSearchParams(q);
  const [from, to] = bucketRange(bucket);
  params.set("from", from);
  params.set("to", to);
  return `${path}?${params.toString()}`;
}

/** Impropis over time with an interquartile band; empty buckets stay empty. */
export function TrendChart({ points, label, height = 300, explorerBase, comparison }: { points: TrendPoint[]; label: string; height?: number; explorerBase?: string; comparison?: { name: string; points: (number | null)[] } }) {
  const linkFor = explorerBase ? (b: string) => bucketHref(explorerBase, b) : undefined;
  const th = useChartTheme();
  const router = useRouter();
  const option = useMemo(() => {
    if (!th) return null;
    const x = points.map((p) => p.bucket);
    const many = points.length > 24;
    return {
      ...baseOption(th),
      grid: { left: 8, right: 16, top: 30, bottom: many ? 44 : 8, containLabel: true },
      legend: { ...((baseOption(th) as { legend: object }).legend), data: [label, "Interval interquartílic (P25–P75)", ...(comparison ? [comparison.name] : [])] },
      xAxis: { type: "category", data: x, boundaryGap: false, ...axisStyle(th), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(th), axisLabel: { color: th.subtle, formatter: (v: number) => `${v} %` } },
      dataZoom: many ? [{ type: "inside" }, { type: "slider", height: 18, bottom: 6, borderColor: th.grid, fillerColor: "rgba(8,137,63,0.12)", handleSize: 14, textStyle: { color: th.subtle } }] : [],
      tooltip: {
        ...((baseOption(th) as { tooltip: object }).tooltip),
        formatter: (params: { dataIndex: number }[]) => {
          const p = points[params[0]!.dataIndex]!;
          if (!p.n) return `<b>${p.bucket}</b><br/>Sense mostres en aquest període`;
          return `<b>${p.bucket}</b><br/>${label}: <b>${nf(p.value!, 2)} %</b><br/>P25–P75: ${nf(p.p25!, 1)}–${nf(p.p75!, 1)} %<br/>n = ${p.n} mostres · ${p.circuits} circuits${comparison ? `<br/>${comparison.name}: ${comparison.points[params[0]!.dataIndex] === null ? "—" : nf(comparison.points[params[0]!.dataIndex]!, 2) + " %"}` : ""}${linkFor ? "<br/><span style='opacity:.7'>Clic: veure les mostres</span>" : ""}`;
        },
      },
      series: [
        { name: "__base", type: "line", data: points.map((p) => p.p25), stack: "band", symbol: "none", lineStyle: { opacity: 0 }, silent: true, connectNulls: false },
        { name: "Interval interquartílic (P25–P75)", type: "line", data: points.map((p) => (p.p25 === null || p.p75 === null ? null : p.p75 - p.p25)), stack: "band", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: th.primary, opacity: 0.14 }, itemStyle: { color: th.primary }, silent: true, connectNulls: false },
        { name: label, type: "line", data: points.map((p) => p.value), connectNulls: false, symbol: "circle", symbolSize: points.length > 40 ? 4 : 7, showSymbol: true, lineStyle: { width: 2, color: th.primary }, itemStyle: { color: th.primary, borderColor: th.surface, borderWidth: 2 }, emphasis: { scale: 1.4 } },
        ...(comparison ? [{ name: comparison.name, type: "line", data: comparison.points, connectNulls: false, symbol: "diamond", symbolSize: 7, lineStyle: { width: 2, type: "dashed", color: th.series[1] }, itemStyle: { color: th.series[1] } }] : []),
      ],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [th, points, label, comparison, explorerBase]);
  return <EChart option={option} height={height} ariaLabel={`${label}: sèrie temporal`} onClick={linkFor ? (p) => p.name && router.push(linkFor(p.name)) : undefined} />;
}

/** Number of samples per bucket: separate chart (never a second y-axis). */
export function CountChart({ points, height = 120 }: { points: { bucket: string; n: number }[]; height?: number }) {
  const th = useChartTheme();
  const option = useMemo(() => {
    if (!th) return null;
    return {
      ...baseOption(th),
      grid: { left: 8, right: 16, top: 18, bottom: 4, containLabel: true },
      legend: { show: false },
      xAxis: { type: "category", data: points.map((p) => p.bucket), ...axisStyle(th), axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: "value", name: "n mostres", nameTextStyle: { color: th.subtle, align: "left" }, ...axisStyle(th), splitNumber: 2 },
      tooltip: { ...((baseOption(th) as { tooltip: object }).tooltip), formatter: (ps: { name: string; value: number }[]) => `<b>${ps[0]!.name}</b><br/>${ps[0]!.value} mostres` },
      series: [{ type: "bar", data: points.map((p) => p.n), barMaxWidth: 14, itemStyle: { color: th.subtle, borderRadius: [3, 3, 0, 0] } }],
    };
  }, [th, points]);
  return <EChart option={option} height={height} ariaLabel="Nombre de mostres per període" />;
}

/** Stacked improper composition (pp of reference mass) per bucket: shares one denominator, parts are exclusive. */
export function CompositionChart({ rows, height = 300, horizontal = false }: { rows: { bucket: string; n: number; groups: Record<string, number> }[]; height?: number; horizontal?: boolean }) {
  const th = useChartTheme();
  const option = useMemo(() => {
    if (!th) return null;
    const cat = { type: "category", data: rows.map((r) => r.bucket), ...axisStyle(th), splitLine: { show: false } };
    const val = { type: "value", ...axisStyle(th), axisLabel: { color: th.subtle, formatter: (v: number) => `${v} pp` } };
    return {
      ...baseOption(th),
      grid: { left: 8, right: 16, top: 62, bottom: 8, containLabel: true },
      legend: { ...((baseOption(th) as { legend: object }).legend), type: "plain", width: "100%" },
      xAxis: horizontal ? val : cat,
      yAxis: horizontal ? { ...cat, inverse: true } : val,
      tooltip: {
        ...((baseOption(th) as { tooltip: object }).tooltip),
        axisPointer: { type: "shadow" },
        formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) => {
          const r = rows[ps[0]!.dataIndex]!;
          const total = ps.reduce((a, p) => a + (p.value ?? 0), 0);
          return `<b>${r.bucket}</b> · n = ${r.n}<br/>${ps
            .slice()
            .reverse()
            .map((p) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px"></span>${p.seriesName}: <b>${nf(p.value, 2)} pp</b>`)
            .join("<br/>")}<br/>Total impropis: <b>${nf(total, 2)} %</b>`;
        },
      },
      series: CHART_GROUPS.map((g) => ({
        name: g.label,
        type: "bar",
        stack: "imp",
        barMaxWidth: 34,
        data: rows.map((r) => (r.n ? Number((r.groups[g.id] ?? 0).toFixed(3)) : null)),
        itemStyle: { color: th.series[g.slot - 1], borderColor: th.surface, borderWidth: 1 },
        emphasis: { focus: "series" },
      })),
    };
  }, [th, rows, horizontal]);
  return <EChart option={option} height={height} ariaLabel="Composició dels impropis per període" />;
}

/** Horizontal bars with diverging colours (worse = red, better = blue) for pp changes. */
export function DivergingBars({ rows, height, unit = "pp", onSelect }: { rows: { label: string; value: number; lo?: number; hi?: number; n?: string }[]; height?: number; unit?: string; onSelect?: (label: string) => void }) {
  const th = useChartTheme();
  const option = useMemo(() => {
    if (!th) return null;
    return {
      ...baseOption(th),
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      legend: { show: false },
      xAxis: { type: "value", ...axisStyle(th), axisLabel: { color: th.subtle, formatter: (v: number) => `${v > 0 ? "+" : ""}${v}` } },
      yAxis: { type: "category", data: rows.map((r) => r.label), inverse: true, ...axisStyle(th), splitLine: { show: false }, axisLabel: { color: th.muted, width: 180, overflow: "truncate" } },
      tooltip: {
        ...((baseOption(th) as { tooltip: object }).tooltip),
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex]!;
          return `<b>${r.label}</b><br/>${r.value > 0 ? "+" : ""}${nf(r.value, 2)} ${unit}${r.lo !== undefined ? `<br/>IC 95 % aprox.: ${nf(r.lo, 1)} a ${nf(r.hi!, 1)}` : ""}${r.n ? `<br/>${r.n}` : ""}`;
        },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          data: rows.map((r) => ({ value: r.value, itemStyle: { color: r.value > 0 ? th.series[7] : th.series[0], borderRadius: r.value > 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
          markLine: { silent: true, symbol: "none", data: [{ xAxis: 0 }], lineStyle: { color: th.axis, type: "solid" }, label: { show: false } },
        },
      ],
    };
  }, [th, rows, unit]);
  return <EChart option={option} height={height ?? Math.max(160, rows.length * 28 + 40)} ariaLabel="Variació en punts percentuals" onClick={onSelect ? (p) => p.name && onSelect(p.name) : undefined} />;
}

/** Box plots (distribution) for 2–4 compared entities. */
export function BoxplotChart({ rows, height = 260 }: { rows: { label: string; min: number; q1: number; median: number; q3: number; max: number; n: number }[]; height?: number }) {
  const th = useChartTheme();
  const option = useMemo(() => {
    if (!th) return null;
    return {
      ...baseOption(th),
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      legend: { show: false },
      xAxis: { type: "category", data: rows.map((r) => r.label), ...axisStyle(th), splitLine: { show: false }, axisLabel: { color: th.muted, interval: 0, width: 140, overflow: "truncate" } },
      yAxis: { type: "value", name: "% impropis", nameTextStyle: { color: th.subtle, align: "left" }, ...axisStyle(th) },
      tooltip: {
        ...((baseOption(th) as { tooltip: object }).tooltip),
        trigger: "item",
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex]!;
          return `<b>${r.label}</b> · n = ${r.n}<br/>Mín. ${nf(r.min, 1)} · P25 ${nf(r.q1, 1)} · Mediana <b>${nf(r.median, 1)}</b> · P75 ${nf(r.q3, 1)} · Màx. ${nf(r.max, 1)} %`;
        },
      },
      series: [
        {
          type: "boxplot",
          data: rows.map((r, i) => ({ value: [r.min, r.q1, r.median, r.q3, r.max], itemStyle: { color: "transparent", borderColor: th.series[i % 8], borderWidth: 2 } })),
          boxWidth: [18, 46],
        },
      ],
    };
  }, [th, rows]);
  return <EChart option={option} height={height} ariaLabel="Distribució del percentatge d'impropis" />;
}

/** Simple bars with n in the tooltip (e.g. monthly seasonality). */
export function BarsWithN({ rows, height = 240, yName = "% impropis", color }: { rows: { label: string; value: number | null; n: number }[]; height?: number; yName?: string; color?: (th: ChartTheme) => string }) {
  const th = useChartTheme();
  const option = useMemo(() => {
    if (!th) return null;
    return {
      ...baseOption(th),
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      legend: { show: false },
      xAxis: { type: "category", data: rows.map((r) => r.label), ...axisStyle(th), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(th), axisLabel: { color: th.subtle, formatter: (v: number) => (yName.startsWith("%") || yName === "%" ? `${v} %` : yName === "pp" ? `${v} pp` : `${v}`) } },
      tooltip: { ...((baseOption(th) as { tooltip: object }).tooltip), axisPointer: { type: "shadow" }, formatter: (ps: { dataIndex: number }[]) => { const r = rows[ps[0]!.dataIndex]!; return `<b>${r.label}</b><br/>${r.value === null ? "Sense dades" : `${nf(r.value, 2)}`}<br/>n = ${r.n}`; } },
      series: [{ type: "bar", data: rows.map((r) => r.value), barMaxWidth: 26, itemStyle: { color: color ? color(th) : th.primary, borderRadius: [4, 4, 0, 0] } }],
    };
  }, [th, rows, yName, color]);
  return <EChart option={option} height={height} ariaLabel={yName} />;
}

/** Sample-level scatter over time for one circuit (anomalies highlighted). */
export function SampleScatter({ points, height = 260, onSelect, highlightId }: { points: { id: string; date: string; value: number; flagged: boolean }[]; height?: number; onSelect?: (id: string) => void; highlightId?: string }) {
  const th = useChartTheme();
  const option = useMemo(() => {
    if (!th) return null;
    return {
      ...baseOption(th),
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      legend: { ...((baseOption(th) as { legend: object }).legend), data: ["Mostra", "Anomalia robusta", ...(highlightId ? ["Aquesta mostra"] : [])] },
      xAxis: { type: "time", ...axisStyle(th), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(th), axisLabel: { color: th.subtle, formatter: (v: number) => `${v} %` } },
      tooltip: { ...((baseOption(th) as { tooltip: object }).tooltip), trigger: "item", formatter: (p: { data: [string, number, string] }) => `<b>Butlletí ${p.data[2]}</b><br/>${p.data[0]}<br/>${nf(p.data[1], 2)} % impropis` },
      series: [
        { name: "Mostra", type: "scatter", symbolSize: 8, data: points.filter((p) => !p.flagged).map((p) => [p.date, p.value, p.id]), itemStyle: { color: th.series[0], opacity: 0.75, borderColor: th.surface, borderWidth: 1 } },
        { name: "Anomalia robusta", type: "scatter", symbol: "diamond", symbolSize: 13, data: points.filter((p) => p.flagged).map((p) => [p.date, p.value, p.id]), itemStyle: { color: th.series[7], borderColor: th.surface, borderWidth: 1 } },
        ...(highlightId
          ? [{ name: "Aquesta mostra", type: "scatter", symbol: "circle", symbolSize: 16, z: 5, data: points.filter((p) => p.id === highlightId).map((p) => [p.date, p.value, p.id]), itemStyle: { color: "transparent", borderColor: th.ink, borderWidth: 2.5 } }]
          : []),
      ],
    };
  }, [th, points, highlightId]);
  return <EChart option={option} height={height} ariaLabel="Mostres del circuit al llarg del temps" onClick={onSelect ? (p) => { const d = p.data as [string, number, string] | undefined; if (d) onSelect(d[2]); } : undefined} />;
}
