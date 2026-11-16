import { z } from "zod";
import { FiltersSchema } from "@/lib/analytics/filters";
import { jsonError } from "@/lib/api";
import { listReports, saveReport } from "@/features/reports/store";
import { emptyReport, runResearch } from "@/features/reports/research";

export async function GET() {
  return Response.json({ reports: listReports() });
}

const CreateSchema = z.object({
  question: z.string().trim().min(3).max(600),
  title: z.string().trim().max(160).optional(),
  filters: FiltersSchema.partial().default({}),
  empty: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid request: question (3–600 chars) and filters required");
  const filters = FiltersSchema.parse(body.data.filters);
  try {
    const report = body.data.empty ? emptyReport(body.data.title || body.data.question, body.data.question, filters) : runResearch(body.data.question, filters, body.data.title);
    saveReport(report);
    return Response.json({ id: report.id }, { status: 201 });
  } catch (err) {
    return jsonError(500, (err as Error).message);
  }
}
