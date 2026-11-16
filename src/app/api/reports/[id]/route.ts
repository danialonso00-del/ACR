import { z } from "zod";
import { jsonError } from "@/lib/api";
import { getReport, saveReport } from "@/features/reports/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = getReport((await params).id);
  return r ? Response.json(r) : jsonError(404, "Report not found");
}

const PatchSchema = z.object({ title: z.string().trim().min(1).max(160).optional(), summary: z.string().max(6000).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = getReport((await params).id);
  if (!r) return jsonError(404, "Report not found");
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError(400, "Invalid patch");
  if (body.data.title) r.title = body.data.title;
  if (body.data.summary !== undefined) r.summary = body.data.summary;
  r.updatedAt = new Date().toISOString();
  saveReport(r);
  return Response.json({ ok: true });
}
