import { z } from "zod";
import { FiltersSchema } from "@/lib/analytics/filters";

export const ReportItemSchema = z.object({
  kind: z.enum(["sample", "assistant", "finding", "chart", "note"]),
  title: z.string().min(1).max(200),
  text: z.string().max(8000),
  sampleIds: z.array(z.string().max(20)).max(500).optional(),
  filters: FiltersSchema.partial().optional(),
  evidence: z
    .array(
      z.object({
        tool: z.string().max(60),
        summary: z.string().max(2000),
        n: z.number().optional(),
        period: z.string().max(60).optional(),
        dataset: z.string().max(120).optional(),
      }),
    )
    .max(20)
    .optional(),
  table: z
    .object({ columns: z.array(z.string().max(80)).max(20), rows: z.array(z.array(z.union([z.string().max(300), z.number(), z.null()])).max(20)).max(200) })
    .optional(),
});
export type ReportItemInput = z.infer<typeof ReportItemSchema>;
export type ReportItem = ReportItemInput & { id: string; addedAt: string };

export interface ReportFinding {
  title: string;
  question: string;
  period: string;
  cohort: string;
  n: string;
  method: string;
  magnitude: string;
  uncertainty: string;
  limitations: string;
  actions: string;
  sampleIds: string[];
  table?: { columns: string[]; rows: (string | number | null)[][] };
}

export interface Report {
  id: string;
  title: string;
  question: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  datasetId: string;
  mode: string;
  filters: Record<string, unknown>;
  scopeLabel: string;
  plan: { scope: string; sources: { name: string; url: string | null; status: string }[]; analyses: string[] };
  queries: { tool: string; input: Record<string, unknown>; at: string }[];
  results: {
    kpis: { label: string; value: string; detail: string }[];
    series: { bucket: string; value: number | null; n: number }[];
    composition: { label: string; pp: number }[];
    exclusions: { label: string; count: number }[];
  } | null;
  summary: string;
  findings: ReportFinding[];
  hypotheses: string[];
  limitations: string[];
  nextSteps: string[];
  items: ReportItem[];
}
