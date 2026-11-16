"use client";
import { useEffect, useRef, useState, createContext, useContext } from "react";
import * as echarts from "echarts/core";
import { BarChart, BoxplotChart, LineChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { LegacyGridContainLabel } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([BarChart, BoxplotChart, LineChart, ScatterChart, AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, LegacyGridContainLabel, SVGRenderer]);

export interface ChartTheme {
  ink: string;
  muted: string;
  subtle: string;
  grid: string;
  axis: string;
  surface: string;
  series: string[];
  /** Brand green for single-series marks (multi-series charts keep the validated categorical order). */
  primary: string;
  brand: string;
  warn: string;
  danger: string;
  nodata: string;
  reducedMotion: boolean;
}

function readTheme(): ChartTheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    ink: v("--ink"),
    muted: v("--muted"),
    subtle: v("--subtle"),
    grid: v("--grid"),
    axis: v("--axis"),
    surface: v("--surface"),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--series-${i}`)),
    primary: v("--chart-primary"),
    brand: v("--arc-green-dark"),
    warn: v("--warning"),
    danger: v("--danger"),
    nodata: v("--nodata"),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function useChartTheme(): ChartTheme | null {
  const [theme, setTheme] = useState<ChartTheme | null>(null);
  useEffect(() => {
    const update = () => setTheme(readTheme());
    update();
    window.addEventListener("arc-theme", update);
    return () => window.removeEventListener("arc-theme", update);
  }, []);
  return theme;
}

/** Shared base options: recessive axes, tabular tooltip, Inter. */
export function baseOption(th: ChartTheme): EChartsCoreOption {
  return {
    animation: !th.reducedMotion,
    animationDuration: 220,
    animationDurationUpdate: 200,
    textStyle: { fontFamily: "Inter Variable, Inter, system-ui, sans-serif", color: th.muted, fontSize: 12 },
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: th.surface,
      borderColor: th.grid,
      textStyle: { color: th.ink, fontSize: 12 },
      extraCssText: "box-shadow:0 8px 24px -8px rgba(0,0,0,.25);border-radius:10px;padding:8px 10px;font-variant-numeric:tabular-nums;",
      axisPointer: { type: "line", lineStyle: { color: th.axis } },
    },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: th.muted, fontSize: 12 } },
    aria: { enabled: true },
  };
}

export const axisStyle = (th: ChartTheme) => ({
  axisLine: { lineStyle: { color: th.axis } },
  axisTick: { show: false },
  axisLabel: { color: th.subtle, fontSize: 11.5 },
  splitLine: { lineStyle: { color: th.grid, width: 1 } },
});

type ChartRegistry = { set: (c: echarts.ECharts | null) => void };
export const ChartRegistryContext = createContext<ChartRegistry | null>(null);

export function EChart({ option, height = 280, ariaLabel, onClick }: { option: EChartsCoreOption | null; height?: number; ariaLabel: string; onClick?: (params: { name?: string; seriesName?: string; dataIndex?: number; data?: unknown }) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const registry = useContext(ChartRegistryContext);
  const clickRef = useRef(onClick);
  useEffect(() => {
    clickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: "svg" });
    chart.current = c;
    registry?.set(c);
    c.on("click", (p) => clickRef.current?.(p as never));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      registry?.set(null);
      c.dispose();
      chart.current = null;
    };
  }, [registry]);

  useEffect(() => {
    if (chart.current && option) chart.current.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="relative w-full">
      <div ref={el} className="absolute inset-0" />
      {!option ? <div className="skeleton absolute inset-2" /> : null}
    </div>
  );
}
